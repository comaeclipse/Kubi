import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { fetchVideoDetails } from "@/lib/youtube";
import { asc, gt, inArray } from "drizzle-orm";

// Videos reclassified per request. Each one costs a Data API slot (batched 50 at
// a time) plus a /shorts probe, so the batch is sized to stay well inside the
// function timeout — the client walks the library by looping on nextCursor,
// the same chunking the channel import uses.
const BATCH_SIZE = 200;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireOperator();
    if (auth instanceof NextResponse) return auth;

    // Keyset pagination on id rather than offset: rows inserted by a concurrent
    // import can't shift the window and cause videos to be skipped.
    let cursor = 0;
    try {
      const body = await request.json();
      if (typeof body?.cursor === "number") cursor = body.cursor;
    } catch {
      // No body — start from the beginning.
    }

    const batch = await db
      .select({
        id: videos.id,
        youtubeVideoId: videos.youtubeVideoId,
        isShort: videos.isShort,
      })
      .from(videos)
      .where(gt(videos.id, cursor))
      .orderBy(asc(videos.id))
      .limit(BATCH_SIZE);

    if (batch.length === 0) {
      return NextResponse.json({
        scanned: 0,
        shortsFound: 0,
        changed: 0,
        nextCursor: null,
      });
    }

    const details = await fetchVideoDetails(batch.map((v) => v.youtubeVideoId));
    const detailsMap = new Map(details.map((d) => [d.youtubeVideoId, d]));

    // Collect the ids whose flag actually flips, so the whole batch costs two
    // UPDATEs instead of one round-trip per video.
    const toShort: number[] = [];
    const toRegular: number[] = [];
    let shortsFound = 0;

    for (const video of batch) {
      const detail = detailsMap.get(video.youtubeVideoId);
      // Missing detail means the video is deleted or private — leave it alone
      // rather than guessing at its classification.
      if (!detail) continue;
      if (detail.isShort) shortsFound++;
      if (detail.isShort === video.isShort) continue;
      (detail.isShort ? toShort : toRegular).push(video.id);
    }

    if (toShort.length > 0) {
      await db
        .update(videos)
        .set({ isShort: true })
        .where(inArray(videos.id, toShort));
    }
    if (toRegular.length > 0) {
      await db
        .update(videos)
        .set({ isShort: false })
        .where(inArray(videos.id, toRegular));
    }

    return NextResponse.json({
      scanned: batch.length,
      shortsFound,
      changed: toShort.length + toRegular.length,
      // A short batch means the table is exhausted; anything else may have more.
      nextCursor:
        batch.length < BATCH_SIZE ? null : batch[batch.length - 1].id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scan for Shorts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
