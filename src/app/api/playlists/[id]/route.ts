import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { playlists, playlistVideos, videos, channels, videoProgress } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    const [playlist] = await db
      .select()
      .from(playlists)
      .where(eq(playlists.id, parseInt(id)));

    if (!playlist) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Access check: shared playlist or matching profile
    if (playlist.profileId !== null) {
      if (!profileId || playlist.profileId !== parseInt(profileId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const playlistVideoRows = await db
      .select({
        id: videos.id,
        youtubeVideoId: videos.youtubeVideoId,
        title: videos.title,
        thumbnailUrl: videos.thumbnailUrl,
        publishedAt: videos.publishedAt,
        duration: videos.duration,
        channelId: videos.channelId,
        channelTitle: channels.title,
        channelThumbnailUrl: channels.thumbnailUrl,
        youtubeChannelId: channels.youtubeChannelId,
        position: playlistVideos.position,
        progressSeconds: profileId
          ? sql<number | null>`(
              SELECT ${videoProgress.progressSeconds}
              FROM ${videoProgress}
              WHERE ${videoProgress.youtubeVideoId} = ${videos.youtubeVideoId}
                AND ${videoProgress.profileId} = ${parseInt(profileId)}
            )`
          : sql<null>`NULL`,
      })
      .from(playlistVideos)
      .innerJoin(videos, eq(playlistVideos.videoId, videos.id))
      .innerJoin(channels, eq(videos.channelId, channels.id))
      .where(eq(playlistVideos.playlistId, parseInt(id)))
      .orderBy(asc(playlistVideos.position));

    return NextResponse.json({
      playlist,
      videos: playlistVideoRows,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch playlist" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name } = await request.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [playlist] = await db
      .select()
      .from(playlists)
      .where(eq(playlists.id, parseInt(id)));

    if (!playlist) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (playlist.profileId === null) {
      if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const [updated] = await db
      .update(playlists)
      .set({ name: name.trim() })
      .where(eq(playlists.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update playlist" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [playlist] = await db
      .select()
      .from(playlists)
      .where(eq(playlists.id, parseInt(id)));

    if (!playlist) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (playlist.profileId === null) {
      if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    await db.delete(playlists).where(eq(playlists.id, parseInt(id)));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete playlist" },
      { status: 500 }
    );
  }
}
