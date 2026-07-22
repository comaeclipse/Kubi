import { and, eq, ilike, inArray, not, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  profileChannels,
  profileVideos,
  profiles,
  userChannels,
  videos,
} from "@/db/schema";

export interface ProfileContentRules {
  /**
   * Every channel this profile may watch something from — whole channels and
   * pick-some channels alike. Empty means a valid profile with an
   * intentionally empty library — distinct from `null` for an invalid profile.
   * Use this for channel-level questions (which rails to show); it is NOT
   * sufficient to scope a video query, because a channel in here may only be
   * partially approved. Use `videoFilter` for that.
   */
  channelIds: number[];
  /**
   * The complete "may this profile watch this video" predicate over `videos`.
   * Covers channel approval AND per-video selection, so every content query
   * must apply this rather than filtering on `channelIds` itself.
   */
  videoFilter: SQL;
  /**
   * Excludes videos whose title contains one of the profile's blocked words.
   * `undefined` when nothing is blocked; drizzle drops undefined out of
   * `and()`, so callers can pass it through unconditionally.
   */
  titleFilter: SQL | undefined;
}

// `%` and `_` are LIKE wildcards and `\` is the escape character, so a parent
// who blocks a word containing one must not end up with a pattern that matches
// more than they typed.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * A predicate over `videos.title` that rejects every blocked word. Exported so
 * routes that already resolved a profile's channels don't have to re-query.
 */
export function blockedTitleFilter(keywords: string[]): SQL | undefined {
  if (keywords.length === 0) return undefined;
  return and(
    ...keywords.map((word) => not(ilike(videos.title, `%${escapeLike(word)}%`)))
  );
}

/**
 * Everything needed to scope a content query to one child: which videos they
 * may watch, plus their blocked-word filter. Returns `null` when the profile
 * doesn't exist or belongs to another account, so callers can fail closed.
 */
export async function getProfileContentRules(
  userId: number,
  profileId: number
): Promise<ProfileContentRules | null> {
  if (!Number.isFinite(profileId)) return null;

  const [profile] = await db
    .select({ id: profiles.id, blockedKeywords: profiles.blockedKeywords })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
    .limit(1);
  if (!profile) return null;

  // Joined against userChannels so a channel the parent removed from the
  // family library stops counting even if the per-profile row survives.
  const rows = await db
    .select({
      channelId: profileChannels.channelId,
      allVideos: profileChannels.allVideos,
    })
    .from(profileChannels)
    .innerJoin(
      userChannels,
      and(
        eq(userChannels.channelId, profileChannels.channelId),
        eq(userChannels.userId, userId)
      )
    )
    .where(eq(profileChannels.profileId, profileId));

  const wholeChannelIds = rows.filter((r) => r.allVideos).map((r) => r.channelId);
  const pickedChannelIds = rows
    .filter((r) => !r.allVideos)
    .map((r) => r.channelId);

  const clauses: SQL[] = [];
  if (wholeChannelIds.length > 0) {
    clauses.push(inArray(videos.channelId, wholeChannelIds));
  }
  if (pickedChannelIds.length > 0) {
    // Belt and braces: the video must be individually picked AND belong to a
    // channel that is still approved in pick-some mode.
    clauses.push(
      and(
        inArray(videos.channelId, pickedChannelIds),
        sql`EXISTS (SELECT 1 FROM ${profileVideos} WHERE ${profileVideos.profileId} = ${profileId} AND ${profileVideos.videoId} = ${videos.id})`
      )!
    );
  }

  return {
    channelIds: rows.map((row) => row.channelId),
    // No approvals at all: fail closed rather than matching everything.
    videoFilter: clauses.length === 0 ? sql`false` : or(...clauses)!,
    titleFilter: blockedTitleFilter(profile.blockedKeywords ?? []),
  };
}
