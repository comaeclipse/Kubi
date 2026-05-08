import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, videos } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";
import { fetchAllVideos, fetchVideoDetails } from "@/lib/youtube";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const channelId = parseInt(id);

    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId));

    if (!channel) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    // Get the newest known video to stop at
    const [newestVideo] = await db
      .select()
      .from(videos)
      .where(eq(videos.channelId, channelId))
      .orderBy(desc(videos.publishedAt))
      .limit(1);

    const stopAtVideoId = newestVideo?.youtubeVideoId;

    const newVideos = await fetchAllVideos(
      channel.uploadsPlaylistId,
      stopAtVideoId
    );

    if (newVideos.length > 0) {
      const videoIds = newVideos.map((v) => v.youtubeVideoId);
      const details = await fetchVideoDetails(videoIds);
      const detailsMap = new Map(details.map((d) => [d.youtubeVideoId, d]));

      const batchSize = 100;
      for (let i = 0; i < newVideos.length; i += batchSize) {
        const batch = newVideos.slice(i, i + batchSize);
        await db.insert(videos).values(
          batch.map((v) => ({
            channelId,
            youtubeVideoId: v.youtubeVideoId,
            title: v.title,
            thumbnailUrl: v.thumbnailUrl,
            publishedAt: v.publishedAt,
            duration: detailsMap.get(v.youtubeVideoId)?.duration || null,
            isShort: detailsMap.get(v.youtubeVideoId)?.isShort ?? false,
          }))
        );
      }
    }

    return NextResponse.json({ newVideoCount: newVideos.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync channel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
