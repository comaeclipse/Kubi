import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, channels, videoProgress, userChannels } from "@/db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { userOwnsProfile } from "@/lib/ownership";
import { visibleChannel } from "@/lib/channel-visibility";

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const url = new URL(request.url);
    const profileIdParam = url.searchParams.get("profileId");
    // Only honor a profileId the caller actually owns (it drives progress).
    const profileId =
      profileIdParam &&
      (await userOwnsProfile(auth.id, parseInt(profileIdParam)))
        ? profileIdParam
        : null;

    // Restrict the home spotlight to channels this account has enabled.
    const enabledRows = await db
      .select({ channelId: userChannels.channelId })
      .from(userChannels)
      .where(eq(userChannels.userId, auth.id));
    const enabledIds = enabledRows.map((r) => r.channelId);
    if (enabledIds.length === 0) {
      return NextResponse.json([]);
    }

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
      .where(and(inArray(channels.id, enabledIds), visibleChannel(auth.id)))
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
