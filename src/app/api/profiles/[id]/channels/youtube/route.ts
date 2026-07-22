import { NextResponse } from "next/server";
import { and, eq, min, sql } from "drizzle-orm";

import { db } from "@/db";
import { channels, profileChannels, userChannels } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { userOwnsProfile } from "@/lib/ownership";
import { importVideoPage } from "@/lib/channel-import";
import { fetchChannelInfo } from "@/lib/youtube";

// Hard cap on how many channels one account may introduce to the platform,
// mirroring the private-channel cap on /api/my-channels.
const MAX_OWNED_CHANNELS = 25;

// POST /api/profiles/[id]/channels/youtube   body: { youtubeChannelId }
//
// Adds a channel found through search and approves it for this profile in one
// step. Three cases, and only the last one costs an import:
//
//   already ours     -> enable + approve (silent, instant)
//   exists, not ours -> adopt the existing row: enable + approve, NO re-import.
//                       One real YouTube channel is ingested exactly once
//                       platform-wide; a second household just gets its own
//                       enablement of the same row.
//   brand new        -> create it owned by this account, then import the first
//                       page (~50 newest videos) so it's immediately usable.
//                       The daily sync cron backfills the rest.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireParent();
    if (auth instanceof NextResponse) return auth;

    const profileId = Number((await params).id);
    if (!(await userOwnsProfile(auth.id, profileId))) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { youtubeChannelId } = await request.json().catch(() => ({}));
    if (
      typeof youtubeChannelId !== "string" ||
      !/^UC[\w-]{22}$/.test(youtubeChannelId)
    ) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: channels.id, title: channels.title })
      .from(channels)
      .where(eq(channels.youtubeChannelId, youtubeChannelId))
      .limit(1);

    let channelId: number;
    let imported = 0;

    if (existing) {
      channelId = existing.id;
    } else {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(channels)
        .where(eq(channels.ownerUserId, auth.id));
      if (Number(count) >= MAX_OWNED_CHANNELS) {
        return NextResponse.json(
          {
            error: `You've reached the limit of ${MAX_OWNED_CHANNELS} added channels. Remove one to add another.`,
          },
          { status: 400 }
        );
      }

      const info = await fetchChannelInfo(youtubeChannelId);
      let created;
      try {
        [created] = await db
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
        // Lost a race against another household adding the same channel —
        // fall through to adopting whatever row won.
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: string }).code === "23505"
        ) {
          const [raced] = await db
            .select({ id: channels.id })
            .from(channels)
            .where(eq(channels.youtubeChannelId, youtubeChannelId))
            .limit(1);
          if (!raced) throw err;
          created = { id: raced.id };
        } else {
          throw err;
        }
      }
      channelId = created.id;

      if (info.uploadsPlaylistId) {
        // Best-effort: a channel with no importable uploads should still be
        // added rather than failing the whole request.
        try {
          const result = await importVideoPage(
            channelId,
            info.uploadsPlaylistId
          );
          imported = result.imported;
          // Park the resume point so the sync cron can walk the back
          // catalogue. Without this the channel would be frozen at its
          // newest 50 videos forever — the cron only ever looks for videos
          // *newer* than what it already has.
          if (result.nextPageToken) {
            await db
              .update(channels)
              .set({ backfillPageToken: result.nextPageToken })
              .where(eq(channels.id, channelId));
          }
        } catch (err) {
          console.error("First-page import failed for", youtubeChannelId, err);
        }
      }
    }

    // Enable for the account (idempotent — may already be enabled).
    await db
      .insert(userChannels)
      .values({ userId: auth.id, channelId })
      .onConflictDoNothing();

    // Approve for this profile at the FRONT of its list, so a just-added
    // channel pops to the beginning instead of landing off the end.
    const [{ minOrder } = { minOrder: null }] = await db
      .select({ minOrder: min(profileChannels.sortOrder) })
      .from(profileChannels)
      .where(eq(profileChannels.profileId, profileId));
    await db
      .insert(profileChannels)
      .values({ profileId, channelId, sortOrder: (minOrder ?? 0) - 1 })
      .onConflictDoNothing();

    const [channel] = await db
      .select()
      .from(channels)
      .where(and(eq(channels.id, channelId)))
      .limit(1);

    return NextResponse.json({
      channel: {
        id: channel.id,
        title: channel.title,
        thumbnailUrl: channel.thumbnailUrl,
      },
      adopted: Boolean(existing),
      imported,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add channel";
    console.error("Add-from-search failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
