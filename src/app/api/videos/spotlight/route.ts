import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, channels, videoProgress } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const profileId = url.searchParams.get("profileId");

    const channelList = await db
      .select({
        id: channels.id,
        youtubeChannelId: channels.youtubeChannelId,
        title: channels.title,
        thumbnailUrl: channels.thumbnailUrl,
        videoCount: sql<number>`count(${videos.id})`,
      })
      .from(channels)
      .leftJoin(
        videos,
        and(eq(videos.channelId, channels.id), eq(videos.hidden, false))
      )
      .groupBy(channels.id)
      .orderBy(sql`RANDOM()`);

    const progressJoinCondition = profileId
      ? and(
          eq(videos.youtubeVideoId, videoProgress.youtubeVideoId),
          eq(videoProgress.profileId, parseInt(profileId))
        )
      : sql`false`;

    const spotlights = await Promise.all(
      channelList
        .filter((ch) => ch.videoCount > 0)
        .map(async (channel) => {
          const vids = await db
            .select({
              id: videos.id,
              youtubeVideoId: videos.youtubeVideoId,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
              publishedAt: videos.publishedAt,
              duration: videos.duration,
              channelTitle: sql<string>`${channel.title}`,
              youtubeChannelId: sql<string>`${channel.youtubeChannelId}`,
              progressSeconds: videoProgress.progressSeconds,
            })
            .from(videos)
            .leftJoin(videoProgress, progressJoinCondition)
            .where(
              and(
                eq(videos.channelId, channel.id),
                eq(videos.hidden, false)
              )
            )
            .orderBy(desc(videos.publishedAt))
            .limit(4);

          return {
            channelId: channel.youtubeChannelId,
            channelTitle: channel.title,
            channelThumbnailUrl: channel.thumbnailUrl,
            videos: vids,
          };
        })
    );

    return NextResponse.json(spotlights.filter((s) => s.videos.length > 0));
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch spotlights" },
      { status: 500 }
    );
  }
}
