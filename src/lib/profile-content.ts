import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { profileChannels, profiles, userChannels } from "@/db/schema";

/**
 * Returns a profile's allowed channel ids only when that profile belongs to
 * the requesting parent. `null` distinguishes an invalid profile from a
 * valid profile with an intentionally empty library.
 */
export async function getProfileChannelIds(
  userId: number,
  profileId: number
): Promise<number[] | null> {
  if (!Number.isFinite(profileId)) return null;

  const [profile] = await db
    .select({ id: profiles.id })
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
  return rows.map((row) => row.channelId);
}
