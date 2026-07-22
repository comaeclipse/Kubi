import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { youtubeSearchCache, youtubeSearchUsage } from "@/db/schema";
import { searchChannels, type ChannelSearchResult } from "@/lib/youtube";

// Quota discipline for YouTube channel search.
//
// search.list costs 100 units against a default 10,000/day budget: about 100
// calls a day for the whole platform, shared by every household. Two things
// keep that from evaporating:
//   1. Every result set is cached by normalized query, so a phrase is only
//      ever bought once (per TTL) no matter who types it.
//   2. Per-account and platform-wide daily caps, so one household typing
//      furiously can't spend everyone else's budget.
//
// The client also debounces, but that is a nicety — never a guarantee. These
// caps are the real defense because they can't be bypassed from the browser.

// Cached results stay usable for a month. Channel names and avatars change
// rarely, and a stale avatar is far cheaper than an exhausted quota.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_SEARCHES_PER_USER_PER_DAY = 20;
const MAX_SEARCHES_PLATFORM_PER_DAY = 80;

// Below this, results are too noisy to be worth 100 units.
export const MIN_QUERY_LENGTH = 3;

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

// Collapse whitespace and case so "  Blippi " and "blippi" share a cache row.
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

// Google's quota resets at midnight Pacific, but bucketing by UTC day is close
// enough to keep one account from monopolizing the budget, and needs no tz math.
function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readCache(
  query: string
): Promise<ChannelSearchResult[] | null> {
  const [row] = await db
    .select()
    .from(youtubeSearchCache)
    .where(eq(youtubeSearchCache.query, query))
    .limit(1);
  if (!row) return null;
  if (Date.now() - row.fetchedAt.getTime() > CACHE_TTL_MS) return null;
  try {
    const parsed = JSON.parse(row.results);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // A corrupt row shouldn't wedge search — treat it as a miss and overwrite.
    return null;
  }
}

async function writeCache(
  query: string,
  results: ChannelSearchResult[]
): Promise<void> {
  await db
    .insert(youtubeSearchCache)
    .values({ query, results: JSON.stringify(results) })
    .onConflictDoUpdate({
      target: youtubeSearchCache.query,
      set: { results: JSON.stringify(results), fetchedAt: new Date() },
    });
}

// Checked only on a cache miss — cached queries are free and must never count
// against a household's allowance.
async function assertUnderQuota(userId: number): Promise<void> {
  const today = utcDay();

  const [mine] = await db
    .select({ count: youtubeSearchUsage.searchCount })
    .from(youtubeSearchUsage)
    .where(
      and(
        eq(youtubeSearchUsage.userId, userId),
        eq(youtubeSearchUsage.usageDate, today)
      )
    );
  if ((mine?.count ?? 0) >= MAX_SEARCHES_PER_USER_PER_DAY) {
    throw new QuotaExceededError(
      "You've reached today's limit for new channel searches. Channels you've already searched for still work."
    );
  }

  const [platform] = await db
    .select({ total: sql<number>`coalesce(sum(${youtubeSearchUsage.searchCount}), 0)` })
    .from(youtubeSearchUsage)
    .where(eq(youtubeSearchUsage.usageDate, today));
  if (Number(platform?.total ?? 0) >= MAX_SEARCHES_PLATFORM_PER_DAY) {
    throw new QuotaExceededError(
      "Channel search is busy right now. Please try again tomorrow, or paste a channel URL instead."
    );
  }
}

async function recordSearch(userId: number): Promise<void> {
  await db
    .insert(youtubeSearchUsage)
    .values({ userId, usageDate: utcDay(), searchCount: 1 })
    .onConflictDoUpdate({
      target: [youtubeSearchUsage.userId, youtubeSearchUsage.usageDate],
      set: { searchCount: sql`${youtubeSearchUsage.searchCount} + 1` },
    });
}

export interface SearchOutcome {
  results: ChannelSearchResult[];
  cached: boolean;
}

// Returns channel matches for a query, buying them from YouTube only when they
// aren't already cached and the caller is within quota.
export async function searchChannelsCached(
  userId: number,
  rawQuery: string
): Promise<SearchOutcome> {
  const query = normalizeQuery(rawQuery);
  if (query.length < MIN_QUERY_LENGTH) return { results: [], cached: true };

  const cached = await readCache(query);
  if (cached) return { results: cached, cached: true };

  await assertUnderQuota(userId);

  let results: ChannelSearchResult[];
  try {
    results = await searchChannels(query);
  } catch (err) {
    if (err instanceof Error && err.message === "youtube_quota_exceeded") {
      throw new QuotaExceededError(
        "Channel search is temporarily unavailable. Please try again tomorrow, or paste a channel URL instead."
      );
    }
    throw err;
  }

  // Count the call and cache the outcome even when empty — a query that
  // legitimately matches nothing shouldn't be re-bought on every keystroke.
  await recordSearch(userId);
  await writeCache(query, results);

  return { results, cached: false };
}
