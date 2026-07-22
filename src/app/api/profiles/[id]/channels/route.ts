import { NextResponse } from "next/server";
import { and, asc, eq, inArray, min, sql } from "drizzle-orm";

import { db } from "@/db";
import { channels, profileChannels, profileVideos, userChannels, videos } from "@/db/schema";
import { requireParent, requireUser } from "@/lib/auth";
import { userOwnsProfile } from "@/lib/ownership";
import { visibleChannel } from "@/lib/channel-visibility";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const profileId = Number((await params).id);
  if (!(await userOwnsProfile(auth.id, profileId))) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Ordered by the profile's own sort, so the client can render the approved
  // list in the same order the kid sees — most recently approved first.
  const rows = await db
    .select({
      channelId: profileChannels.channelId,
      allVideos: profileChannels.allVideos,
    })
    .from(profileChannels)
    .where(eq(profileChannels.profileId, profileId))
    .orderBy(asc(profileChannels.sortOrder));

  // `?detail=1` adds each channel's whole-channel/pick-some state and how many
  // videos are picked. The bare id array is kept as the default because other
  // callers (the admin channel toggles) depend on that shape.
  if (new URL(_request.url).searchParams.has("detail")) {
    const counts = await db
      .select({
        channelId: videos.channelId,
        count: sql<number>`count(*)`,
      })
      .from(profileVideos)
      .innerJoin(videos, eq(videos.id, profileVideos.videoId))
      .where(eq(profileVideos.profileId, profileId))
      .groupBy(videos.channelId);
    const countByChannel = new Map(
      counts.map((row) => [row.channelId, Number(row.count)])
    );

    return NextResponse.json(
      rows.map((row) => ({
        channelId: row.channelId,
        allVideos: row.allVideos,
        selectedCount: countByChannel.get(row.channelId) ?? 0,
      }))
    );
  }

  return NextResponse.json(rows.map((row) => row.channelId));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireParent();
    if (auth instanceof NextResponse) return auth;

    const profileId = Number((await params).id);
    const { channelId, allowed } = await request.json();
    if (!Number.isInteger(channelId) || typeof allowed !== "boolean") {
      return NextResponse.json({ error: "Invalid channel permission" }, { status: 400 });
    }
    if (!(await userOwnsProfile(auth.id, profileId))) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Permissions can only be granted from the parent's enabled library.
    const [enabledChannel] = await db
      .select({ id: channels.id })
      .from(channels)
      .innerJoin(
        userChannels,
        and(eq(userChannels.channelId, channels.id), eq(userChannels.userId, auth.id))
      )
      .where(and(eq(channels.id, channelId), visibleChannel(auth.id)))
      .limit(1);
    if (!enabledChannel) {
      return NextResponse.json({ error: "Channel is not enabled" }, { status: 400 });
    }

    if (allowed) {
      // New approvals pop to the FRONT of this profile's list, so a channel
      // the parent just approved is the first thing they (and the kid) see
      // rather than being appended out of sight.
      const [{ minOrder } = { minOrder: null }] = await db
        .select({ minOrder: min(profileChannels.sortOrder) })
        .from(profileChannels)
        .where(eq(profileChannels.profileId, profileId));
      await db
        .insert(profileChannels)
        .values({ profileId, channelId, sortOrder: (minOrder ?? 0) - 1 })
        .onConflictDoNothing();
    } else {
      await db
        .delete(profileChannels)
        .where(and(eq(profileChannels.profileId, profileId), eq(profileChannels.channelId, channelId)));
      // Drop any per-video picks for this channel too. Access already requires
      // the approval row above, so this is tidiness rather than a gate — but it
      // stops a re-approval from silently resurrecting an old selection.
      await db.delete(profileVideos).where(
        and(
          eq(profileVideos.profileId, profileId),
          inArray(
            profileVideos.videoId,
            db.select({ id: videos.id }).from(videos).where(eq(videos.channelId, channelId))
          )
        )
      );
    }

    return NextResponse.json({ allowed });
  } catch {
    return NextResponse.json({ error: "Failed to update profile access" }, { status: 500 });
  }
}
