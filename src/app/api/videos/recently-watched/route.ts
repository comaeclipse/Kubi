import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videoProgress, videos, channels } from "@/db/schema";
import { eq, and, gt, desc, count } from "drizzle-orm";

const PAGE_SIZE = 12;

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json(
      { error: "profileId is required" },
      { status: 400 }
    );
  }

  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? String(PAGE_SIZE));
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");

  const whereClause = and(
    eq(videoProgress.profileId, parseInt(profileId)),
    gt(videoProgress.progressSeconds, 0),
    eq(videos.hidden, false),
    eq(videos.isShort, false)
  );

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: videos.id,
        youtubeVideoId: videoProgress.youtubeVideoId,
        title: videos.title,
        thumbnailUrl: videos.thumbnailUrl,
        publishedAt: videos.publishedAt,
        duration: videos.duration,
        channelTitle: channels.title,
        channelThumbnailUrl: channels.thumbnailUrl,
        youtubeChannelId: channels.youtubeChannelId,
        progressSeconds: videoProgress.progressSeconds,
      })
      .from(videoProgress)
      .innerJoin(videos, eq(videos.youtubeVideoId, videoProgress.youtubeVideoId))
      .leftJoin(channels, eq(videos.channelId, channels.id))
      .where(whereClause)
      .orderBy(desc(videoProgress.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(videoProgress)
      .innerJoin(videos, eq(videos.youtubeVideoId, videoProgress.youtubeVideoId))
      .where(whereClause),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return NextResponse.json({
    videos: rows,
    total,
    hasMore: offset + rows.length < total,
  });
}
