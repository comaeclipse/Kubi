import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { playlists, playlistVideos, videos, channels, videoProgress } from "@/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getProfileContentRules } from "@/lib/profile-content";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const rules = profileId
      ? await getProfileContentRules(auth.id, Number(profileId))
      : null;
    if (!profileId || rules === null) {
      return NextResponse.json({ error: "A valid profile is required" }, { status: 403 });
    }

    const [playlist] = await db
      .select()
      .from(playlists)
      .where(and(eq(playlists.id, parseInt(id)), eq(playlists.userId, auth.id)));

    if (!playlist) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Within the account, a kid-owned playlist is only visible to that kid.
    if (playlist.profileId !== null) {
      if (!profileId || playlist.profileId !== parseInt(profileId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const playlistVideoRows = await db
      .select({
        id: videos.id,
        youtubeVideoId: videos.youtubeVideoId,
        publicId: videos.publicId,
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
              WHERE ${videoProgress.videoIdHash} = ${videos.youtubeVideoIdHash}
                AND ${videoProgress.profileId} = ${parseInt(profileId)}
            )`
          : sql<null>`NULL`,
      })
      .from(playlistVideos)
      .innerJoin(videos, eq(playlistVideos.videoId, videos.id))
      .innerJoin(channels, eq(videos.channelId, channels.id))
      .where(
        and(
          eq(playlistVideos.playlistId, parseInt(id)),
          rules.videoFilter,
          rules.titleFilter
        )
      )
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
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { name } = await request.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [updated] = await db
      .update(playlists)
      .set({ name: name.trim() })
      .where(and(eq(playlists.id, parseInt(id)), eq(playlists.userId, auth.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

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
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await db
      .delete(playlists)
      .where(and(eq(playlists.id, parseInt(id)), eq(playlists.userId, auth.id)));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete playlist" },
      { status: 500 }
    );
  }
}
