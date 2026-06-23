import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videoProgress, videos, channels } from "@/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { userOwnsProfile } from "@/lib/ownership";

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const profileId = req.nextUrl.searchParams.get("profileId");

  if (!profileId || !(await userOwnsProfile(auth.id, parseInt(profileId)))) {
    return NextResponse.json(null);
  }

  const rows = await db
    .select({
      youtubeVideoId: videos.youtubeVideoId,
      publicId: videos.publicId,
      progressSeconds: videoProgress.progressSeconds,
      updatedAt: videoProgress.updatedAt,
      videoId: videos.id,
      title: videos.title,
      thumbnailUrl: videos.thumbnailUrl,
      duration: videos.duration,
      channelTitle: channels.title,
      youtubeChannelId: channels.youtubeChannelId,
    })
    .from(videoProgress)
    .innerJoin(videos, eq(videos.youtubeVideoIdHash, videoProgress.videoIdHash))
    .leftJoin(channels, eq(videos.channelId, channels.id))
    .where(
      and(
        eq(videoProgress.profileId, parseInt(profileId)),
        gt(videoProgress.progressSeconds, 0),
        eq(videos.hidden, false)
      )
    )
    .orderBy(desc(videoProgress.updatedAt))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json(null);
  }

  return NextResponse.json(rows[0]);
}
