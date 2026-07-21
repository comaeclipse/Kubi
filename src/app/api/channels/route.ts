import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, profileChannels, userChannels } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import crypto from "crypto";
import { requireUser, requireOperator } from "@/lib/auth";
import {
  parseChannelIdentifier,
  fetchChannelInfo,
} from "@/lib/youtube";
import { DEFAULT_CDN_HOSTNAME, DEFAULT_LIBRARY_ID } from "@/lib/bunny";
import { getChannelLabelMap } from "@/lib/taxonomy";
import { visibleChannel } from "@/lib/channel-visibility";
import { userOwnsProfile } from "@/lib/ownership";

function withCover<T extends { source: string; bunnyCoverVideoId: string | null; thumbnailUrl: string | null }>(
  ch: T
) {
  return {
    ...ch,
    // For Bunny channels, expose the cover as a (server-signed) thumbnail
    // URL derived from the chosen cover video.
    thumbnailUrl:
      ch.source === "bunny"
        ? ch.bunnyCoverVideoId
          ? `/api/bunny/thumbnail/${ch.bunnyCoverVideoId}`
          : ch.thumbnailUrl
        : ch.thumbnailUrl,
  };
}

// GET /api/channels                  -> channels this account has enabled (kid-facing)
// GET /api/channels?all=1            -> the full master library annotated with `enabled`
//                                       (for the per-account toggle UI)
// GET /api/channels?profileId=<id>   -> only this profile's approved channels,
//                                       in that profile's own drag-to-reorder order
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const url = new URL(request.url);
    const all = url.searchParams.has("all");
    const profileIdParam = url.searchParams.get("profileId");

    if (profileIdParam !== null) {
      const profileId = Number(profileIdParam);
      if (
        !Number.isInteger(profileId) ||
        !(await userOwnsProfile(auth.id, profileId))
      ) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }

      const rows = await db
        .select({ channel: channels })
        .from(profileChannels)
        .innerJoin(channels, eq(channels.id, profileChannels.channelId))
        .where(eq(profileChannels.profileId, profileId))
        .orderBy(asc(profileChannels.sortOrder));

      return NextResponse.json(rows.map((row) => withCover(row.channel)));
    }

    // Master library + the caller's own private channels. Other users' (and the
    // operator's view of other users') private channels never appear here.
    const allChannels = await db
      .select()
      .from(channels)
      .where(visibleChannel(auth.id))
      .orderBy(asc(channels.title));

    const enabledRows = await db
      .select({ channelId: userChannels.channelId })
      .from(userChannels)
      .where(eq(userChannels.userId, auth.id));
    const enabledIds = new Set(enabledRows.map((r) => r.channelId));
    const labelMap =
      auth.isOperator && all
        ? await getChannelLabelMap(allChannels.map((channel) => channel.id))
        : new Map();

    const withCovers = allChannels
      .filter((ch) => all || enabledIds.has(ch.id))
      .map((ch) => ({
        ...ch,
        enabled: enabledIds.has(ch.id),
        ...(auth.isOperator && all
          ? { labels: labelMap.get(ch.id) ?? [] }
          : {}),
        // For Bunny channels, expose the cover as a (server-signed) thumbnail
        // URL derived from the chosen cover video.
        thumbnailUrl:
          ch.source === "bunny"
            ? ch.bunnyCoverVideoId
              ? `/api/bunny/thumbnail/${ch.bunnyCoverVideoId}`
              : ch.thumbnailUrl
            : ch.thumbnailUrl,
      }));

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
    const auth = await requireOperator();
    if (auth instanceof NextResponse) return auth;

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
