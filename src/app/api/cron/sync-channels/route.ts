import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, videos, settings } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { fetchAllVideos, fetchVideoDetails } from "@/lib/youtube";
import { videoIdBlindIndex } from "@/lib/crypto";
import { generatePublicId } from "@/lib/public-id";

const HISTORY_KEY = "cron_sync_history";
const MAX_HISTORY = 20;

export const maxDuration = 300; // 5 minutes (Vercel Pro max for cron)

export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (or manually with the secret)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Master library only — private channels aren't auto-synced (owner re-imports
  // manually) to avoid burning YouTube quota on them.
  const allChannels = await db
    .select()
    .from(channels)
    .where(isNull(channels.ownerUserId));

  const results: { channelId: number; title: string; newVideos: number; skippedShorts: number; error?: string }[] = [];

  for (const channel of allChannels) {
    // Skip manually-managed (e.g. Bunny) channels — nothing to sync.
    if (!channel.uploadsPlaylistId) continue;
    try {
      // Load all known video IDs for this channel so fetchAllVideos can stop
      // at the first one it encounters in the playlist. A single "newest" ID
      // breaks when the channel deletes or privates that video (e.g. Peppa
      // Pig's daily live streams), causing the entire 8700-video playlist to
      // be traversed on every cron run.
      const knownRows = await db
        .select({ youtubeVideoId: videos.youtubeVideoId })
        .from(videos)
        .where(eq(videos.channelId, channel.id));
      const knownVideoIds = new Set(knownRows.map((r) => r.youtubeVideoId));

      const newVideos = await fetchAllVideos(
        channel.uploadsPlaylistId,
        knownVideoIds
      );

      if (newVideos.length === 0) {
        results.push({ channelId: channel.id, title: channel.title, newVideos: 0, skippedShorts: 0 });
        continue;
      }

      const videoIds = newVideos.map((v) => v.youtubeVideoId);
      const details = await fetchVideoDetails(videoIds);
      const detailsMap = new Map(details.map((d) => [d.youtubeVideoId, d]));

      // Filter out Shorts before inserting
      const regularVideos = newVideos.filter((v) => {
        const detail = detailsMap.get(v.youtubeVideoId);
        return detail && !detail.isShort;
      });

      const skippedShorts = newVideos.length - regularVideos.length;

      if (regularVideos.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < regularVideos.length; i += batchSize) {
          const batch = regularVideos.slice(i, i + batchSize);
          await db
            .insert(videos)
            .values(
              batch.map((v) => ({
                channelId: channel.id,
                youtubeVideoId: v.youtubeVideoId,
                youtubeVideoIdHash: videoIdBlindIndex(v.youtubeVideoId),
                publicId: generatePublicId(),
                title: v.title,
                thumbnailUrl: v.thumbnailUrl,
                publishedAt: v.publishedAt,
                duration: detailsMap.get(v.youtubeVideoId)?.duration || null,
                isShort: false,
              }))
            )
            .onConflictDoNothing(); // Deduplicate by youtubeVideoId
        }
      }

      results.push({
        channelId: channel.id,
        title: channel.title,
        newVideos: regularVideos.length,
        skippedShorts,
      });
    } catch (error) {
      results.push({
        channelId: channel.id,
        title: channel.title,
        newVideos: 0,
        skippedShorts: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const totalNew = results.reduce((sum, r) => sum + r.newVideos, 0);
  const totalShorts = results.reduce((sum, r) => sum + r.skippedShorts, 0);

  // Persist run record to settings table
  const runRecord = {
    ranAt: new Date().toISOString(),
    totalNewVideos: totalNew,
    totalShortsSkipped: totalShorts,
    channels: results,
  };

  try {
    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, HISTORY_KEY));

    const history = existing ? JSON.parse(existing.value) : [];
    history.unshift(runRecord);
    if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);

    await db
      .insert(settings)
      .values({ key: HISTORY_KEY, value: JSON.stringify(history) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: JSON.stringify(history) },
      });
  } catch {
    // Don't fail the cron if history save fails
  }

  return NextResponse.json({ ok: true, ...runRecord });
}
