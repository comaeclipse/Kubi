import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, profileChannels, profiles, userChannels } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { visibleChannel } from "@/lib/channel-visibility";

// Enable a master-library channel for the current account.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const channelId = parseInt((await params).id);
    if (!Number.isFinite(channelId)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    // Ensure the channel is one this account may see (master or its own
    // private channel) — stops a user enabling another user's private channel.
    const [channel] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(and(eq(channels.id, channelId), visibleChannel(auth.id)));
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    await db
      .insert(userChannels)
      .values({ userId: auth.id, channelId })
      .onConflictDoNothing();

    return NextResponse.json({ enabled: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to enable channel" },
      { status: 500 }
    );
  }
}

// Disable a master-library channel for the current account.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const channelId = parseInt((await params).id);
    if (!Number.isFinite(channelId)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    await db
      .delete(userChannels)
      .where(
        and(
          eq(userChannels.userId, auth.id),
          eq(userChannels.channelId, channelId)
        )
      );

    // Removing a channel from the family library revokes it for every child;
    // otherwise re-enabling it later could unexpectedly restore access.
    // Scoped to this account's own profiles — an unscoped delete here would
    // revoke the channel for every household on the platform.
    await db.delete(profileChannels).where(
      and(
        eq(profileChannels.channelId, channelId),
        inArray(
          profileChannels.profileId,
          db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, auth.id))
        )
      )
    );

    return NextResponse.json({ enabled: false });
  } catch {
    return NextResponse.json(
      { error: "Failed to disable channel" },
      { status: 500 }
    );
  }
}
