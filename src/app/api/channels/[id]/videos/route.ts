import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, videos, videoProgress } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";

// Add a Bunny video to a channel by its Bunny video GUID. Manual metadata:
// the title is supplied by the admin; thumbnail/duration are derived/omitted.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const channelId = parseInt(id);
    const body = await request.json();

    const bunnyVideoId =
      typeof body.bunnyVideoId === "string" ? body.bunnyVideoId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!bunnyVideoId || !title) {
      return NextResponse.json(
        { error: "bunnyVideoId and title are required" },
        { status: 400 }
      );
    }

    const [channel] = await db
      .select({ id: channels.id, source: channels.source })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel || channel.source !== "bunny") {
      return NextResponse.json(
        { error: "Bunny channel not found" },
        { status: 404 }
      );
    }

    const [video] = await db
      .insert(videos)
      .values({
        channelId,
        youtubeVideoId: bunnyVideoId,
        title,
        publishedAt: new Date().toISOString(),
        source: "bunny",
      })
      .onConflictDoNothing({ target: videos.youtubeVideoId })
      .returning();

    if (!video) {
      return NextResponse.json(
        { error: "That Bunny video ID is already added" },
        { status: 409 }
      );
    }

    return NextResponse.json({ video });
  } catch {
    return NextResponse.json(
      { error: "Failed to add video" },
      { status: 500 }
    );
  }
}

// Remove a video from a channel (used by the Bunny channel video manager).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const channelId = parseInt(id);
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    const [video] = await db
      .select({ youtubeVideoId: videos.youtubeVideoId })
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.channelId, channelId)))
      .limit(1);

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Clean up progress rows (no FK constraint reaches video_progress).
    await db
      .delete(videoProgress)
      .where(eq(videoProgress.youtubeVideoId, video.youtubeVideoId));

    // Deleting the video cascades to playlist_videos.
    await db.delete(videos).where(eq(videos.id, videoId));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to remove video" },
      { status: 500 }
    );
  }
}
