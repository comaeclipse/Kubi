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
const STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;

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

/** Convert a duration in seconds to an ISO-8601 string (PT#H#M#S) so the
 *  existing formatDuration/isoToSeconds helpers in lib/youtube.ts work. */
export function secondsToIso8601(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hPart = h ? `${h}H` : "";
  const mPart = m ? `${m}M` : "";
  // Always emit a seconds part when there are no hours/minutes (e.g. PT0S).
  const sPart = sec || (!h && !m) ? `${sec}S` : "";
  return `PT${hPart}${mPart}${sPart}`;
}

export interface BunnyLibraryVideo {
  guid: string;
  title: string;
  lengthSeconds: number;
  status: number; // 4 = finished/ready
  dateUploaded: string;
}

/** List all videos in a Bunny Stream library via the management API
 *  (paginated). Requires BUNNY_STREAM_API_KEY. */
export async function listLibraryVideos(
  libraryId: string
): Promise<BunnyLibraryVideo[]> {
  if (!STREAM_API_KEY) {
    throw new Error("BUNNY_STREAM_API_KEY is not configured");
  }

  const perPage = 100;
  let page = 1;
  const out: BunnyLibraryVideo[] = [];

  for (;;) {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos?page=${page}&itemsPerPage=${perPage}&orderBy=date`,
      {
        headers: { AccessKey: STREAM_API_KEY, accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      throw new Error(`Bunny API error (${res.status})`);
    }

    const data = await res.json();
    const items: unknown[] = Array.isArray(data.items) ? data.items : [];
    for (const raw of items) {
      const v = raw as Record<string, unknown>;
      out.push({
        guid: String(v.guid),
        title: typeof v.title === "string" && v.title ? v.title : "(untitled)",
        lengthSeconds: typeof v.length === "number" ? v.length : 0,
        status: typeof v.status === "number" ? v.status : 0,
        dateUploaded:
          typeof v.dateUploaded === "string"
            ? v.dateUploaded
            : new Date().toISOString(),
      });
    }

    const total = typeof data.totalItems === "number" ? data.totalItems : out.length;
    if (items.length === 0 || out.length >= total) break;
    page++;
  }

  return out;
}
