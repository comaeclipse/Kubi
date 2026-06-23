import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, userChannels, videos } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { parseChannelIdentifier, fetchChannelInfo } from "@/lib/youtube";

// Hard cap on how many private channels one account may own.
const MAX_PRIVATE_CHANNELS = 25;

// GET /api/my-channels -> the caller's own private channels (with video counts).
export async function GET() {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const videoCountSq = db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(videos)
      .where(eq(videos.channelId, channels.id));

    const rows = await db
      .select({
        id: channels.id,
        title: channels.title,
        thumbnailUrl: channels.thumbnailUrl,
        youtubeChannelId: channels.youtubeChannelId,
        createdAt: channels.createdAt,
        videoCount: sql<number>`(${videoCountSq})`,
      })
      .from(channels)
      .where(eq(channels.ownerUserId, auth.id))
      .orderBy(asc(channels.title));

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch your channels" },
      { status: 500 }
    );
  }
}

// POST /api/my-channels  body: { input }
// Adds a YouTube channel privately to the caller's account: enforces the cap,
// rejects channels that already exist anywhere (one real channel = one row
// system-wide), then creates it owned by the caller and auto-enables it.
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { input } = await request.json();
    if (!input || typeof input !== "string" || !input.trim()) {
      return NextResponse.json(
        { error: "Channel URL or ID required" },
        { status: 400 }
      );
    }

    // Enforce the per-account cap.
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(channels)
      .where(eq(channels.ownerUserId, auth.id));
    if (Number(count) >= MAX_PRIVATE_CHANNELS) {
      return NextResponse.json(
        {
          error: `You've reached the limit of ${MAX_PRIVATE_CHANNELS} channels. Remove one to add another.`,
        },
        { status: 400 }
      );
    }

    const channelId = await parseChannelIdentifier(input.trim());
    const info = await fetchChannelInfo(channelId);

    // One real YouTube channel exists once system-wide. If it's already here —
    // master or privately owned — block with a friendly message rather than
    // creating a duplicate.
    const [existing] = await db
      .select({ id: channels.id, ownerUserId: channels.ownerUserId })
      .from(channels)
      .where(eq(channels.youtubeChannelId, info.channelId))
      .limit(1);
    if (existing) {
      const error =
        existing.ownerUserId === null
          ? "This channel is already available — enable it in your channel list."
          : existing.ownerUserId === auth.id
            ? "You've already added this channel."
            : "This channel has already been added.";
      return NextResponse.json({ error }, { status: 409 });
    }

    let channel;
    try {
      [channel] = await db
        .insert(channels)
        .values({
          youtubeChannelId: info.channelId,
          title: info.title,
          thumbnailUrl: info.thumbnailUrl,
          uploadsPlaylistId: info.uploadsPlaylistId,
          ownerUserId: auth.id,
        })
        .returning();
    } catch (err) {
      // Backstop for a race against the existence check above (unique violation
      // on youtube_channel_id).
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "23505"
      ) {
        return NextResponse.json(
          { error: "This channel has already been added." },
          { status: 409 }
        );
      }
      throw err;
    }

    // Auto-enable for the account so it shows for the kids immediately.
    await db
      .insert(userChannels)
      .values({ userId: auth.id, channelId: channel.id })
      .onConflictDoNothing();

    return NextResponse.json({
      channel,
      uploadsPlaylistId: info.uploadsPlaylistId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add channel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
