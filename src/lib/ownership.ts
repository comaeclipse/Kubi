import { db } from "@/db";
import { profiles, playlists } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// True if the given profile exists and belongs to the user. Used to keep one
// account from reading/writing another account's kid data.
export async function userOwnsProfile(
  userId: number,
  profileId: number
): Promise<boolean> {
  if (!Number.isFinite(profileId)) return false;
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)));
  return Boolean(row);
}

// True if the given playlist exists and belongs to the user.
export async function userOwnsPlaylist(
  userId: number,
  playlistId: number
): Promise<boolean> {
  if (!Number.isFinite(playlistId)) return false;
  const [row] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.userId, userId)));
  return Boolean(row);
}
