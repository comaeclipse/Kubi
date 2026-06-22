import { NextResponse } from "next/server";
import { and, eq, inArray, notInArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  channelLabels,
  channels,
  labels,
  videoLabels,
  videos,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";

const MAX_LIMIT = 20;
const MAX_EXCLUSIONS = 200;

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const requestedLimit = Number(body.limit);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isInteger(requestedLimit) ? requestedLimit : MAX_LIMIT)
    );
    const excludeVideoIds = Array.from(
      new Set(
        Array.isArray(body.excludeVideoIds)
          ? body.excludeVideoIds
              .filter(Number.isInteger)
              .slice(-MAX_EXCLUSIONS)
          : []
      )
    ) as number[];

    const musicChannelIds = db
      .select({ channelId: channelLabels.channelId })
      .from(channelLabels)
      .innerJoin(labels, eq(channelLabels.labelId, labels.id))
      .where(and(eq(labels.slug, "music"), eq(labels.kind, "category")));

    const musicVideoIds = db
      .select({ videoId: videoLabels.videoId })
      .from(videoLabels)
      .innerJoin(labels, eq(videoLabels.labelId, labels.id))
      .where(and(eq(labels.slug, "music"), eq(labels.kind, "category")));

    const eligibility = and(
      eq(videos.source, "youtube"),
      eq(videos.hidden, false),
      eq(videos.isShort, false),
      or(
        inArray(videos.channelId, musicChannelIds),
        inArray(videos.id, musicVideoIds)
      ),
      excludeVideoIds.length > 0
        ? notInArray(videos.id, excludeVideoIds)
        : undefined
    );

    const [queue, countRows] = await Promise.all([
      db
        .select({
          id: videos.id,
          youtubeVideoId: videos.youtubeVideoId,
          title: videos.title,
          duration: videos.duration,
          thumbnailUrl: videos.thumbnailUrl,
          channelId: channels.id,
          youtubeChannelId: channels.youtubeChannelId,
          channelTitle: channels.title,
          channelThumbnailUrl: channels.thumbnailUrl,
        })
        .from(videos)
        .innerJoin(channels, eq(videos.channelId, channels.id))
        .where(eligibility)
        .orderBy(sql`RANDOM()`)
        .limit(limit),
      db
        .select({ count: sql<number>`count(*)` })
        .from(videos)
        .where(
          and(
            eq(videos.source, "youtube"),
            eq(videos.hidden, false),
            eq(videos.isShort, false),
            or(
              inArray(videos.channelId, musicChannelIds),
              inArray(videos.id, musicVideoIds)
            )
          )
        ),
    ]);

    return NextResponse.json({
      videos: queue,
      eligibleCount: Number(countRows[0]?.count ?? 0),
    });
  } catch (error) {
    console.error("Failed to build music queue", error);
    return NextResponse.json(
      { error: "Failed to build music queue" },
      { status: 500 }
    );
  }
}
