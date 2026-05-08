import { NextResponse } from "next/server";
import { db } from "@/db";
import { playlistVideos } from "@/db/schema";
import { eq, and, sql, max } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { videoId } = await request.json();
    const playlistId = parseInt(id);

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    // Get max position
    const [maxRow] = await db
      .select({ maxPos: max(playlistVideos.position) })
      .from(playlistVideos)
      .where(eq(playlistVideos.playlistId, playlistId));

    const nextPosition = (maxRow?.maxPos ?? -1) + 1;

    await db
      .insert(playlistVideos)
      .values({
        playlistId,
        videoId,
        position: nextPosition,
      })
      .onConflictDoNothing();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to add video to playlist" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { videoId } = await request.json();
    const playlistId = parseInt(id);

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    await db
      .delete(playlistVideos)
      .where(
        and(
          eq(playlistVideos.playlistId, playlistId),
          eq(playlistVideos.videoId, videoId)
        )
      );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to remove video from playlist" },
      { status: 500 }
    );
  }
}
