import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { asc } from "drizzle-orm";
import crypto from "crypto";
import { isAdmin } from "@/lib/auth";
import {
  parseChannelIdentifier,
  fetchChannelInfo,
} from "@/lib/youtube";
import { DEFAULT_CDN_HOSTNAME, DEFAULT_LIBRARY_ID } from "@/lib/bunny";

export async function GET() {
  try {
    const allChannels = await db
      .select()
      .from(channels)
      .orderBy(asc(channels.title));

    // For Bunny channels, expose the cover as a (server-signed) thumbnail URL
    // derived from the chosen cover video.
    const withCovers = allChannels.map((ch) =>
      ch.source === "bunny"
        ? {
            ...ch,
            thumbnailUrl: ch.bunnyCoverVideoId
              ? `/api/bunny/thumbnail/${ch.bunnyCoverVideoId}`
              : ch.thumbnailUrl,
          }
        : ch
    );

    return NextResponse.json(withCovers);
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

    const body = await request.json();

    // --- Bunny channel (manually managed, no YouTube lookup) ---
    if (body.source === "bunny") {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        return NextResponse.json(
          { error: "Channel name required" },
          { status: 400 }
        );
      }

      const libraryId =
        (typeof body.bunnyLibraryId === "string" && body.bunnyLibraryId.trim()) ||
        DEFAULT_LIBRARY_ID ||
        null;
      const cdnHostname =
        (typeof body.bunnyCdnHostname === "string" &&
          body.bunnyCdnHostname.trim()) ||
        DEFAULT_CDN_HOSTNAME ||
        null;

      const [channel] = await db
        .insert(channels)
        .values({
          youtubeChannelId: `bunny-${crypto.randomUUID()}`,
          title,
          source: "bunny",
          bunnyLibraryId: libraryId,
          bunnyCdnHostname: cdnHostname,
        })
        .returning();

      return NextResponse.json({ channel });
    }

    // --- YouTube channel (existing behaviour) ---
    const { input } = body;
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
