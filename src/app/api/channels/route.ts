import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { asc } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";
import {
  parseChannelIdentifier,
  fetchChannelInfo,
} from "@/lib/youtube";

export async function GET() {
  try {
    const allChannels = await db.select().from(channels).orderBy(asc(channels.title));
    return NextResponse.json(allChannels);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { input } = await request.json();
    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "Channel URL or ID required" },
        { status: 400 }
      );
    }

    const channelId = await parseChannelIdentifier(input);
    const info = await fetchChannelInfo(channelId);

    // Upsert — if the channel already exists (e.g. a previous partial import),
    // update its metadata and return it so the import loop can continue.
    const [channel] = await db
      .insert(channels)
      .values({
        youtubeChannelId: info.channelId,
        title: info.title,
        thumbnailUrl: info.thumbnailUrl,
        uploadsPlaylistId: info.uploadsPlaylistId,
      })
      .onConflictDoUpdate({
        target: channels.youtubeChannelId,
        set: {
          title: info.title,
          thumbnailUrl: info.thumbnailUrl,
          uploadsPlaylistId: info.uploadsPlaylistId,
        },
      })
      .returning();

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
