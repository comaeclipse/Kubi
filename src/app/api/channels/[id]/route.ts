import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, videos, videoProgress } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireOperator } from "@/lib/auth";
import { videoIdBlindIndex } from "@/lib/crypto";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOperator();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const updates: Partial<typeof channels.$inferInsert> = {};
    if (typeof body.title === "string" && body.title.trim()) {
      updates.title = body.title.trim();
    }
    if ("bunnyCoverVideoId" in body) {
      updates.bunnyCoverVideoId = body.bunnyCoverVideoId || null;
    }
    if (typeof body.bunnyLibraryId === "string") {
      updates.bunnyLibraryId = body.bunnyLibraryId.trim() || null;
    }
    if (typeof body.bunnyCdnHostname === "string") {
      updates.bunnyCdnHostname = body.bunnyCdnHostname.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const [updated] = await db
      .update(channels)
      .set(updates)
      .where(eq(channels.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update channel" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOperator();
    if (auth instanceof NextResponse) return auth;

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
          videoProgress.videoIdHash,
          channelVideos.map((v) => videoIdBlindIndex(v.youtubeVideoId))
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
