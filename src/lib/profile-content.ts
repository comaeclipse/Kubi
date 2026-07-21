import { and, eq, ilike, not, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { profileChannels, profiles, userChannels, videos } from "@/db/schema";

export interface ProfileContentRules {
  /**
   * Channels this profile may watch. Empty means a valid profile with an
   * intentionally empty library — distinct from `null` for an invalid profile.
   */
  channelIds: number[];
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
 * Everything needed to scope a content query to one child: the channels the
 * parent approved for them, plus their blocked-word filter. Returns `null`
 * when the profile doesn't exist or belongs to another account, so callers can
 * fail closed.
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

  const rows = await db
    .select({ channelId: profileChannels.channelId })
    .from(profileChannels)
    .innerJoin(
      userChannels,
      and(
        eq(userChannels.channelId, profileChannels.channelId),
        eq(userChannels.userId, userId)
      )
    )
    .where(eq(profileChannels.profileId, profileId));

  return {
    channelIds: rows.map((row) => row.channelId),
    titleFilter: blockedTitleFilter(profile.blockedKeywords ?? []),
  };
}
