import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, userChannels } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

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

    // Ensure the channel exists in the master library.
    const [channel] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.id, channelId));
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

    return NextResponse.json({ enabled: false });
  } catch {
    return NextResponse.json(
      { error: "Failed to disable channel" },
      { status: 500 }
    );
  }
}
