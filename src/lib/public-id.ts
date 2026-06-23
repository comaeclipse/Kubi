import crypto from "crypto";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";

// Public watch-URL ids for YouTube videos: an 11-char token over YouTube's own
// id alphabet (A-Z a-z 0-9 _ -) so the URL bar never reveals the real YouTube
// video id. Stored per-video; the real id stays server-side for the embed.
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"; // 64 chars

export function generatePublicId(length = 11): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] & 63]; // 64-char alphabet → unbiased mask
  }
  return out;
}

// Resolve a /watch/[slug] route id to its real youtube_video_id. YouTube videos
// resolve ONLY by their scrambled public_id (the real id is never accepted);
// Bunny videos keep resolving by their GUID (which is already their id).
export async function resolveYoutubeVideoId(
  slug: string
): Promise<string | null> {
  const [row] = await db
    .select({ youtubeVideoId: videos.youtubeVideoId })
    .from(videos)
    .where(
      or(
        eq(videos.publicId, slug),
        and(eq(videos.source, "bunny"), eq(videos.youtubeVideoId, slug))
      )
    )
    .limit(1);
  return row?.youtubeVideoId ?? null;
}
