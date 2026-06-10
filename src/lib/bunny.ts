import crypto from "crypto";

/**
 * Server-only helpers for Bunny Stream.
 *
 * Two independent security mechanisms exist in Bunny and they use DIFFERENT
 * keys/algorithms:
 *
 *  1. Embed View Token Authentication (the iframe player at
 *     player.mediadelivery.net) — token = SHA256_HEX(key + videoId + expires).
 *     Key: BUNNY_STREAM_TOKEN_SECURITY_KEY (the Stream library's token key).
 *
 *  2. CDN URL Token Authentication (the pull zone vz-xxxx.b-cdn.net that serves
 *     thumbnails / HLS) — Basic scheme: Base64url(MD5(key + path + expires)).
 *     Key: BUNNY_CDN_TOKEN_SECURITY_KEY. This is only needed if the pull zone
 *     itself has token auth enabled; if it doesn't, leave the env var unset and
 *     thumbnails are served unsigned.
 *
 * IMPORTANT: never import this module into a client component — it reads secret
 * keys from the environment.
 */

const EMBED_KEY = process.env.BUNNY_STREAM_TOKEN_SECURITY_KEY;
const CDN_KEY = process.env.BUNNY_CDN_TOKEN_SECURITY_KEY;

export const DEFAULT_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
export const DEFAULT_CDN_HOSTNAME = process.env.BUNNY_STREAM_CDN_HOSTNAME;

const DEFAULT_TTL_SECONDS = 60 * 60; // 1 hour

function unixExpires(ttlSeconds: number): number {
  return Math.floor(Date.now() / 1000) + ttlSeconds;
}

/**
 * Build a signed Bunny Stream embed URL for the iframe player. Falls back to an
 * unsigned URL when no embed token key is configured (i.e. the library has
 * Embed View Token Authentication turned off).
 */
export function buildEmbedUrl(
  libraryId: string,
  videoId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): string {
  const base = `https://player.mediadelivery.net/embed/${libraryId}/${videoId}`;
  const params = new URLSearchParams({
    preload: "true",
    rememberPosition: "true",
  });

  if (EMBED_KEY) {
    const expires = unixExpires(ttlSeconds);
    const token = crypto
      .createHash("sha256")
      .update(EMBED_KEY + videoId + expires)
      .digest("hex");
    params.set("token", token);
    params.set("expires", String(expires));
  }

  return `${base}?${params.toString()}`;
}

/**
 * Build a (possibly signed) Bunny CDN thumbnail URL. Signs with the CDN pull
 * zone Basic token scheme when a CDN key is configured; otherwise returns the
 * plain URL. Returns null when no CDN hostname is available.
 */
export function buildThumbnailUrl(
  cdnHostname: string | null | undefined,
  videoId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): string | null {
  const host = cdnHostname || DEFAULT_CDN_HOSTNAME;
  if (!host) return null;

  const path = `/${videoId}/thumbnail.jpg`;
  const base = `https://${host}${path}`;

  if (!CDN_KEY) return base;

  const expires = unixExpires(ttlSeconds);
  const token = crypto
    .createHash("md5")
    .update(CDN_KEY + path + expires)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${base}?token=${token}&expires=${expires}`;
}

/** Resolve the effective library id for a Bunny channel row. */
export function resolveLibraryId(
  channelLibraryId: string | null | undefined
): string | null {
  return channelLibraryId || DEFAULT_LIBRARY_ID || null;
}
