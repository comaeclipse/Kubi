import { NextResponse } from "next/server";
import { and, eq, max } from "drizzle-orm";

import { db } from "@/db";
import { channels, profileChannels, userChannels } from "@/db/schema";
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

  const rows = await db
    .select({ channelId: profileChannels.channelId })
    .from(profileChannels)
    .where(eq(profileChannels.profileId, profileId));
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
      // New approvals land at the end of this profile's reorder list.
      const [{ maxOrder } = { maxOrder: null }] = await db
        .select({ maxOrder: max(profileChannels.sortOrder) })
        .from(profileChannels)
        .where(eq(profileChannels.profileId, profileId));
      await db
        .insert(profileChannels)
        .values({ profileId, channelId, sortOrder: (maxOrder ?? -1) + 1 })
        .onConflictDoNothing();
    } else {
      await db
        .delete(profileChannels)
        .where(and(eq(profileChannels.profileId, profileId), eq(profileChannels.channelId, channelId)));
    }

    return NextResponse.json({ allowed });
  } catch {
    return NextResponse.json({ error: "Failed to update profile access" }, { status: 500 });
  }
}
