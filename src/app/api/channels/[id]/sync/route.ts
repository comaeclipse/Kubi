import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, videos } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireOperator } from "@/lib/auth";
import { fetchAllVideos, fetchVideoDetails } from "@/lib/youtube";
import { videoIdBlindIndex } from "@/lib/crypto";
import { generatePublicId } from "@/lib/public-id";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOperator();
    if (auth instanceof NextResponse) return auth;

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

    if (!channel.uploadsPlaylistId) {
      return NextResponse.json(
        { error: "This channel cannot be synced" },
        { status: 400 }
      );
    }

    // Get the newest known video to stop at
    const [newestVideo] = await db
      .select()
      .from(videos)
      .where(eq(videos.channelId, channelId))
      .orderBy(desc(videos.publishedAt))
      .limit(1);

    const knownVideoIds = newestVideo
      ? new Set([newestVideo.youtubeVideoId])
      : undefined;

    const newVideos = await fetchAllVideos(
      channel.uploadsPlaylistId,
      knownVideoIds
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
            youtubeVideoIdHash: videoIdBlindIndex(v.youtubeVideoId),
            publicId: generatePublicId(),
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
