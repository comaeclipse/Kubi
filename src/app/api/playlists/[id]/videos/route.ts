import { NextResponse } from "next/server";
import { db } from "@/db";
import { playlistVideos, videos } from "@/db/schema";
import { eq, and, inArray, max } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { userOwnsPlaylist } from "@/lib/ownership";
import { getProfileContentRules } from "@/lib/profile-content";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { videoId, profileId } = await request.json();
    const playlistId = parseInt(id);

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    if (!(await userOwnsPlaylist(auth.id, playlistId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rules = await getProfileContentRules(auth.id, Number(profileId));
    if (!rules?.channelIds.length) {
      return NextResponse.json({ error: "A valid profile with channel access is required" }, { status: 403 });
    }
    const [video] = await db
      .select({ id: videos.id })
      .from(videos)
      .where(
        and(
          eq(videos.id, videoId),
          inArray(videos.channelId, rules.channelIds),
          rules.titleFilter
        )
      )
      .limit(1);
    if (!video) {
      return NextResponse.json({ error: "Video is not available to this profile" }, { status: 403 });
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
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { videoId } = await request.json();
    const playlistId = parseInt(id);

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    if (!(await userOwnsPlaylist(auth.id, playlistId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
