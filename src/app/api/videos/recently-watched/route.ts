import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videoProgress, videos, channels } from "@/db/schema";
import { eq, and, gt, desc, count, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { userOwnsProfile } from "@/lib/ownership";
import { getProfileContentRules } from "@/lib/profile-content";

const PAGE_SIZE = 12;

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const profileId = req.nextUrl.searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json(
      { error: "profileId is required" },
      { status: 400 }
    );
  }

  if (!(await userOwnsProfile(auth.id, parseInt(profileId)))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rules = await getProfileContentRules(auth.id, parseInt(profileId));
  if (!rules?.channelIds.length) {
    return NextResponse.json({ videos: [], total: 0, hasMore: false });
  }

  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? String(PAGE_SIZE));
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");

  const whereClause = and(
    eq(videoProgress.profileId, parseInt(profileId)),
    gt(videoProgress.progressSeconds, 0),
    eq(videos.hidden, false),
    eq(videos.isShort, false),
    inArray(videos.channelId, rules.channelIds),
    rules.titleFilter
  );

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: videos.id,
        youtubeVideoId: videos.youtubeVideoId,
        publicId: videos.publicId,
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
      .innerJoin(videos, eq(videos.youtubeVideoIdHash, videoProgress.videoIdHash))
      .leftJoin(channels, eq(videos.channelId, channels.id))
      .where(whereClause)
      .orderBy(desc(videoProgress.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(videoProgress)
      .innerJoin(videos, eq(videos.youtubeVideoIdHash, videoProgress.videoIdHash))
      .where(whereClause),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return NextResponse.json({
    videos: rows,
    total,
    hasMore: offset + rows.length < total,
  });
}
