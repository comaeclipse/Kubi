import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { labels, videoLabels, videos } from "@/db/schema";
import { requireOperator } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOperator();
  if (auth instanceof NextResponse) return auth;

  const videoId = Number((await params).id);
  const body = await request.json();
  const labelIds = Array.from(
    new Set(
      Array.isArray(body.labelIds)
        ? body.labelIds.filter(Number.isInteger).slice(0, 100)
        : []
    )
  ) as number[];

  const [video] = await db
    .select({ id: videos.id })
    .from(videos)
    .where(eq(videos.id, videoId));
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (labelIds.length > 0) {
    const valid = await db
      .select({ id: labels.id })
      .from(labels)
      .where(inArray(labels.id, labelIds));
    if (valid.length !== labelIds.length) {
      return NextResponse.json({ error: "Unknown label" }, { status: 400 });
    }
  }

  await db.delete(videoLabels).where(eq(videoLabels.videoId, videoId));
  if (labelIds.length > 0) {
    await db
      .insert(videoLabels)
      .values(labelIds.map((labelId) => ({ videoId, labelId })));
  }

  const assigned = await db
    .select({
      id: labels.id,
      slug: labels.slug,
      name: labels.name,
      kind: labels.kind,
    })
    .from(videoLabels)
    .innerJoin(
      labels,
      and(eq(videoLabels.labelId, labels.id), eq(videoLabels.videoId, videoId))
    );
  return NextResponse.json(assigned);
}
