import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { channels, profileChannels, profileVideos, videos } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { userOwnsProfile } from "@/lib/ownership";
import { visibleChannel } from "@/lib/channel-visibility";

const PAGE_SIZE = 60;

// Bunny thumbnails are served through the signing redirect, same as everywhere
// else videos are listed.
function withThumb<T extends { source: string; youtubeVideoId: string; thumbnailUrl: string | null }>(
  video: T
): T {
  if (video.source === "bunny") {
    return { ...video, thumbnailUrl: `/api/bunny/thumbnail/${video.youtubeVideoId}` };
  }
  return video;
}

async function loadContext(userId: number, profileId: number, channelId: number) {
  if (!Number.isInteger(profileId) || !Number.isInteger(channelId)) return null;
  if (!(await userOwnsProfile(userId, profileId))) return null;

  const [channel] = await db
    .select({
      id: channels.id,
      title: channels.title,
      thumbnailUrl: channels.thumbnailUrl,
    })
    .from(channels)
    .where(and(eq(channels.id, channelId), visibleChannel(userId)))
    .limit(1);
  return channel ?? null;
}

// GET .../videos?offset=0 -> one page of the channel's videos plus this
// profile's current selection, for the add-channel picker modal.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  try {
    const auth = await requireParent();
    if (auth instanceof NextResponse) return auth;

    const { id, channelId: channelIdParam } = await params;
    const profileId = Number(id);
    const channelId = Number(channelIdParam);

    const channel = await loadContext(auth.id, profileId, channelId);
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const offset = Math.max(0, Number(new URL(request.url).searchParams.get("offset")) || 0);

    const [approval] = await db
      .select({ allVideos: profileChannels.allVideos })
      .from(profileChannels)
      .where(
        and(
          eq(profileChannels.profileId, profileId),
          eq(profileChannels.channelId, channelId)
        )
      )
      .limit(1);

    const [rows, [{ total }], selected] = await Promise.all([
      db
        .select({
          id: videos.id,
          youtubeVideoId: videos.youtubeVideoId,
          publicId: videos.publicId,
          title: videos.title,
          thumbnailUrl: videos.thumbnailUrl,
          duration: videos.duration,
          publishedAt: videos.publishedAt,
          source: videos.source,
        })
        .from(videos)
        .where(and(eq(videos.channelId, channelId), eq(videos.hidden, false)))
        .orderBy(desc(videos.publishedAt), asc(videos.id))
        .limit(PAGE_SIZE)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)` })
        .from(videos)
        .where(and(eq(videos.channelId, channelId), eq(videos.hidden, false))),
      // Only the picks belonging to this channel — profileVideos is keyed by
      // profile, not channel.
      db
        .select({ videoId: profileVideos.videoId })
        .from(profileVideos)
        .innerJoin(videos, eq(videos.id, profileVideos.videoId))
        .where(
          and(
            eq(profileVideos.profileId, profileId),
            eq(videos.channelId, channelId)
          )
        ),
    ]);

    return NextResponse.json({
      channel,
      approved: Boolean(approval),
      // Default to whole-channel for a channel that isn't approved yet, which
      // is what the modal offers as the one-tap path.
      allVideos: approval ? approval.allVideos : true,
      selectedVideoIds: selected.map((row) => row.videoId),
      videos: rows.map(withThumb),
      total: Number(total),
      hasMore: offset + rows.length < Number(total),
    });
  } catch (error) {
    console.error("Failed to load channel videos", error);
    return NextResponse.json(
      { error: "Failed to load videos" },
      { status: 500 }
    );
  }
}

// PATCH .../videos   body: { allVideos: true }
//                    body: { allVideos: false, videoIds: number[] }
//
// Sets how much of this channel the profile may watch. Whole-channel mode
// clears any per-video picks, so switching back and forth doesn't leave stale
// rows behind.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  try {
    const auth = await requireParent();
    if (auth instanceof NextResponse) return auth;

    const { id, channelId: channelIdParam } = await params;
    const profileId = Number(id);
    const channelId = Number(channelIdParam);

    const channel = await loadContext(auth.id, profileId, channelId);
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const allVideos = body?.allVideos !== false;
    const requestedIds: number[] = Array.isArray(body?.videoIds)
      ? body.videoIds.filter((v: unknown) => Number.isInteger(v))
      : [];

    if (!allVideos && requestedIds.length === 0) {
      return NextResponse.json(
        { error: "Pick at least one video, or choose the whole channel." },
        { status: 400 }
      );
    }

    // The channel must already be approved for this profile — the caller
    // approves it first (or via the search add route), then refines here.
    const [approval] = await db
      .select({ channelId: profileChannels.channelId })
      .from(profileChannels)
      .where(
        and(
          eq(profileChannels.profileId, profileId),
          eq(profileChannels.channelId, channelId)
        )
      )
      .limit(1);
    if (!approval) {
      return NextResponse.json(
        { error: "Approve the channel first" },
        { status: 409 }
      );
    }

    await db
      .update(profileChannels)
      .set({ allVideos })
      .where(
        and(
          eq(profileChannels.profileId, profileId),
          eq(profileChannels.channelId, channelId)
        )
      );

    // Replace this channel's picks wholesale. Scoped by channel so picks for
    // other channels survive.
    const channelVideoIds = db
      .select({ id: videos.id })
      .from(videos)
      .where(eq(videos.channelId, channelId));

    await db
      .delete(profileVideos)
      .where(
        and(
          eq(profileVideos.profileId, profileId),
          inArray(profileVideos.videoId, channelVideoIds)
        )
      );

    let saved = 0;
    if (!allVideos) {
      // Only ids that really belong to this channel — a crafted body must not
      // grant access to some other channel's video.
      const valid = await db
        .select({ id: videos.id })
        .from(videos)
        .where(
          and(eq(videos.channelId, channelId), inArray(videos.id, requestedIds))
        );
      if (valid.length > 0) {
        await db
          .insert(profileVideos)
          .values(valid.map((v) => ({ profileId, videoId: v.id })))
          .onConflictDoNothing();
      }
      saved = valid.length;
    }

    return NextResponse.json({ allVideos, selectedCount: saved });
  } catch (error) {
    console.error("Failed to save channel video selection", error);
    return NextResponse.json(
      { error: "Failed to save selection" },
      { status: 500 }
    );
  }
}
