import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, videos, videoProgress } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const channelId = parseInt(id);

    // Collect youtube video IDs before deletion so we can clean up
    // video_progress (no FK constraint — cascades won't reach it)
    const channelVideos = await db
      .select({ youtubeVideoId: videos.youtubeVideoId })
      .from(videos)
      .where(eq(videos.channelId, channelId));

    if (channelVideos.length > 0) {
      await db.delete(videoProgress).where(
        inArray(
          videoProgress.youtubeVideoId,
          channelVideos.map((v) => v.youtubeVideoId)
        )
      );
    }

    // Deleting the channel cascades to: videos → playlist_videos
    await db.delete(channels).where(eq(channels.id, channelId));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete channel" },
      { status: 500 }
    );
  }
}
