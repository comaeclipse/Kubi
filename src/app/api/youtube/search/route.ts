import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { channels } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import {
  MIN_QUERY_LENGTH,
  QuotaExceededError,
  searchChannelsCached,
} from "@/lib/youtube-search";

// GET /api/youtube/search?q=... -> YouTube channel matches for the autocomplete
// on the profile page. Parent-gated: this spends shared API quota, and adding
// channels is a parent action.
//
// Each result carries `existingChannelId` when we already hold that channel —
// the client shows it as "In your library" and adding it becomes a silent
// enable rather than a fresh import.
export async function GET(request: Request) {
  try {
    const auth = await requireParent();
    if (auth instanceof NextResponse) return auth;

    const query = new URL(request.url).searchParams.get("q") ?? "";
    if (query.trim().length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ results: [] });
    }

    const { results, cached } = await searchChannelsCached(auth.id, query);
    if (results.length === 0) {
      return NextResponse.json({ results: [], cached });
    }

    // One real YouTube channel is one row system-wide, so a plain id lookup
    // tells us whether this is an adopt or an import.
    const existing = await db
      .select({ id: channels.id, youtubeChannelId: channels.youtubeChannelId })
      .from(channels)
      .where(
        inArray(
          channels.youtubeChannelId,
          results.map((r) => r.channelId)
        )
      );
    const existingByYtId = new Map(
      existing.map((row) => [row.youtubeChannelId, row.id])
    );

    return NextResponse.json({
      cached,
      results: results.map((r) => ({
        ...r,
        existingChannelId: existingByYtId.get(r.channelId) ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    console.error("YouTube channel search failed", error);
    return NextResponse.json(
      { error: "Channel search failed. Please try again." },
      { status: 500 }
    );
  }
}
