const API_KEY = process.env.YOUTUBE_API_KEY!;
const BASE_URL = "https://www.googleapis.com/youtube/v3";

interface ChannelInfo {
  channelId: string;
  title: string;
  thumbnailUrl: string;
  uploadsPlaylistId: string;
}

interface VideoInfo {
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
}

interface VideoDetails {
  youtubeVideoId: string;
  duration: string;
  isShort: boolean;
}

export function isoToSeconds(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    (parseInt(match[1] || "0") * 3600) +
    (parseInt(match[2] || "0") * 60) +
    parseInt(match[3] || "0")
  );
}

const SHORTS_PROBE_CONCURRENCY = 8;
const SHORTS_PROBE_TIMEOUT_MS = 5000;
const SHORTS_PROBE_ATTEMPTS = 3;

// YouTube has never allowed a Short to run past 3 minutes (the cap was 60s
// until late 2024). Anything longer is definitively a regular video, so it can
// skip the probe entirely — on a full library re-scan that avoids the probe for
// the large majority of rows.
const SHORTS_MAX_SECONDS = 180;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Asks YouTube whether a video is a Short, rather than guessing from duration.
//
// /shorts/{id} serves the Shorts player (200) only for videos YouTube itself
// classifies as Shorts; everything else 303s over to /watch?v={id}. That is the
// same judgement YouTube's own UI makes, and duration cannot reproduce it in
// either direction: a 9s ASL sign clip and a 16s Short are identical in length,
// while Shorts have been allowed to run up to 3 minutes since late 2024. The
// Data API v3 exposes no Shorts field at all, which is why this probe exists.
//
// Returns null when there is no trustworthy verdict (404 for deleted/private,
// 429, 5xx, network failure) so the caller can fall back to the heuristic.
async function probeIsShort(videoId: string): Promise<boolean | null> {
  for (let attempt = 0; attempt < SHORTS_PROBE_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(SHORTS_PROBE_TIMEOUT_MS),
      });
      if (res.status === 200) return true;
      if (res.status >= 300 && res.status < 400) return false;
      // Rate limiting and server errors are transient. Back off and retry
      // rather than returning no verdict: falling back to the duration guess
      // would silently misclassify legitimate short clips as Shorts, which is
      // exactly the failure this probe exists to prevent.
      if (res.status === 429 || res.status >= 500) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      // 404 and friends — the video is deleted or private. No verdict.
      return null;
    } catch {
      // Network error or timeout.
      await sleep(500 * 2 ** attempt);
    }
  }
  return null;
}

// Probes a batch of ids with bounded concurrency. Values may be null (no verdict).
async function probeShorts(
  videoIds: string[]
): Promise<Map<string, boolean | null>> {
  const verdicts = new Map<string, boolean | null>();
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(SHORTS_PROBE_CONCURRENCY, videoIds.length) },
    async () => {
      while (cursor < videoIds.length) {
        const id = videoIds[cursor++];
        verdicts.set(id, await probeIsShort(id));
      }
    }
  );
  await Promise.all(workers);

  return verdicts;
}

// Fallback only, used when probeIsShort returns no verdict. Deliberately keeps
// the old <=60s rule: it over-rejects legitimate short clips, but erring toward
// rejection is correct for a platform that admits no Shorts at all.
function detectIsShortByDuration(
  duration: string,
  tags: string[],
  description: string
): boolean {
  const secs = isoToSeconds(duration);
  // Duration must be > 0 (exclude live streams stored as P0D / PT0S)
  if (secs === 0) return false;
  const hasShortTag =
    tags.some((t) => t.toLowerCase() === "shorts") ||
    description.toLowerCase().includes("#shorts");
  return secs <= 60 || hasShortTag;
}

export async function parseChannelIdentifier(
  input: string
): Promise<string> {
  let trimmed = input.trim();

  // Decode percent-encoding so handles pasted as URLs (e.g. /@RT%C3%89KIDSjr)
  // resolve to the real handle (@RTÉKIDSjr) instead of truncating at the "%".
  try {
    trimmed = decodeURIComponent(trimmed);
  } catch {
    // Not valid percent-encoding — leave the input as-is.
  }

  // Direct channel ID
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return trimmed;
  }

  // URL formats
  const channelIdMatch = trimmed.match(
    /youtube\.com\/channel\/(UC[\w-]{22})/
  );
  if (channelIdMatch) {
    return channelIdMatch[1];
  }

  // Handle format: @handle or URL with /@handle. Handles may contain unicode
  // letters, so capture everything up to the next path/query separator rather
  // than restricting to ASCII word characters.
  const handleMatch =
    trimmed.match(/youtube\.com\/@([^/?&#\s]+)/) ||
    trimmed.match(/^@([^/?&#\s]+)$/);
  if (handleMatch) {
    const handle = handleMatch[1];
    const res = await fetch(
      `${BASE_URL}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${API_KEY}`
    );
    const data = await res.json();
    if (data.items?.length > 0) {
      return data.items[0].id;
    }
    throw new Error(`Could not resolve handle @${handle}`);
  }

  // Try as raw channel ID or custom URL slug
  throw new Error(`Unrecognized channel identifier: ${trimmed}`);
}

export async function fetchChannelInfo(
  channelId: string
): Promise<ChannelInfo> {
  const res = await fetch(
    `${BASE_URL}/channels?part=snippet,contentDetails&id=${channelId}&key=${API_KEY}`
  );
  const data = await res.json();

  if (!data.items?.length) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const item = data.items[0];
  return {
    channelId: item.id,
    title: item.snippet.title,
    thumbnailUrl: item.snippet.thumbnails.default.url,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
  };
}

export interface ChannelSearchResult {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
}

// Searches YouTube for channels by name.
//
// COSTS 100 QUOTA UNITS PER CALL against a 10,000/day budget — about 100 calls
// a day for the entire platform. Never call this directly from a request
// handler; go through lib/youtube-search.ts, which caches and rate-limits.
export async function searchChannels(
  query: string,
  maxResults = 8
): Promise<ChannelSearchResult[]> {
  const url = new URL(`${BASE_URL}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "channel");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("safeSearch", "strict");
  url.searchParams.set("key", API_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok) {
    // Quota exhaustion arrives as 403 with reason quotaExceeded — surface it
    // distinctly so the caller can tell "out of budget" from "broken".
    const reason = data?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new Error("youtube_quota_exceeded");
    }
    throw new Error(data?.error?.message ?? "YouTube search failed");
  }

  if (!Array.isArray(data.items)) return [];

  return data.items
    .map(
      (item: {
        id?: { channelId?: string };
        snippet?: {
          title?: string;
          description?: string;
          thumbnails?: {
            medium?: { url: string };
            default?: { url: string };
          };
        };
      }) => ({
        channelId: item.id?.channelId ?? "",
        title: item.snippet?.title ?? "",
        description: item.snippet?.description ?? "",
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          "",
      })
    )
    .filter((c: ChannelSearchResult) => c.channelId && c.title);
}

export interface VideoPage {
  videos: VideoInfo[];
  nextPageToken: string | null;
}

// Fetches a single page (up to 50 videos) from a uploads playlist.
// Used by the chunked import flow so each server call stays within timeout limits.
export async function fetchVideoPage(
  uploadsPlaylistId: string,
  pageToken?: string
): Promise<VideoPage> {
  const url = new URL(`${BASE_URL}/playlistItems`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("playlistId", uploadsPlaylistId);
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("key", API_KEY);
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!data.items) return { videos: [], nextPageToken: null };

  const videos: VideoInfo[] = data.items.map((item: { snippet: { resourceId: { videoId: string }; title: string; thumbnails: { medium?: { url: string }; default?: { url: string } }; publishedAt: string } }) => ({
    youtubeVideoId: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    thumbnailUrl:
      item.snippet.thumbnails.medium?.url ||
      item.snippet.thumbnails.default?.url ||
      "",
    publishedAt: item.snippet.publishedAt,
  }));

  return {
    videos,
    nextPageToken: data.nextPageToken ?? null,
  };
}

// knownVideoIds: stop as soon as any already-imported video is encountered.
// Using a Set rather than a single "newest" ID makes incremental sync robust
// against channels that delete or private their latest video (e.g. live
// streams that disappear after broadcast), which would otherwise cause the
// entire playlist to be traversed on every cron run.
export async function fetchAllVideos(
  uploadsPlaylistId: string,
  knownVideoIds?: Set<string>
): Promise<VideoInfo[]> {
  const allVideos: VideoInfo[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${BASE_URL}/playlistItems`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", uploadsPlaylistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", API_KEY);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!data.items) break;

    for (const item of data.items) {
      const videoId = item.snippet.resourceId.videoId;

      if (knownVideoIds?.has(videoId)) {
        return allVideos;
      }

      allVideos.push({
        youtubeVideoId: videoId,
        title: item.snippet.title,
        thumbnailUrl:
          item.snippet.thumbnails.medium?.url ||
          item.snippet.thumbnails.default?.url ||
          "",
        publishedAt: item.snippet.publishedAt,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return allVideos;
}

export async function fetchVideoDetails(
  videoIds: string[]
): Promise<VideoDetails[]> {
  const results: VideoDetails[] = [];

  // Batch in groups of 50 — request snippet + contentDetails in same call (same quota cost)
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const res = await fetch(
      `${BASE_URL}/videos?part=contentDetails,snippet&id=${batch.join(",")}&key=${API_KEY}`
    );
    const data = await res.json();

    if (data.items) {
      for (const item of data.items) {
        const duration: string = item.contentDetails.duration ?? "";
        const tags: string[] = item.snippet.tags ?? [];
        const description: string = item.snippet.description ?? "";
        results.push({
          youtubeVideoId: item.id,
          duration,
          isShort: detectIsShortByDuration(duration, tags, description),
        });
      }
    }
  }

  const flags = await resolveShortFlags(
    results.map((r) => ({
      youtubeVideoId: r.youtubeVideoId,
      duration: r.duration,
      fallback: r.isShort,
    }))
  );
  for (const result of results) {
    result.isShort = flags.get(result.youtubeVideoId) ?? result.isShort;
  }

  return results;
}

export interface ShortFlagCandidate {
  youtubeVideoId: string;
  duration: string;
  // Verdict to keep when the probe reaches no conclusion.
  fallback: boolean;
}

// Resolves the isShort flag for a set of videos using YouTube's own routing,
// falling back per-item only where the probe returns no verdict.
//
// Split out from fetchVideoDetails so that callers which already hold durations
// — a re-classification pass over an existing library, for instance — can reuse
// the exact same classification without spending Data API quota to re-fetch
// metadata they already have.
export async function resolveShortFlags(
  items: ShortFlagCandidate[]
): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>();
  const toProbe: string[] = [];

  for (const item of items) {
    const secs = isoToSeconds(item.duration);
    if (secs > 0 && secs <= SHORTS_MAX_SECONDS) {
      toProbe.push(item.youtubeVideoId);
      flags.set(item.youtubeVideoId, item.fallback);
    } else {
      // Longer than any Short can be, or no duration at all (live streams).
      // Settled without a probe — which also drops the heuristic's #shorts-tag
      // false positives: a 4-minute video tagged #shorts is not a Short,
      // whatever its description claims.
      flags.set(item.youtubeVideoId, false);
    }
  }

  // Costs no API quota — it's a HEAD against youtube.com, not the Data API —
  // so it stays clear of the 10k/day budget.
  const verdicts = await probeShorts(toProbe);
  for (const [id, verdict] of verdicts) {
    if (verdict !== null) flags.set(id, verdict);
  }

  return flags;
}

export function formatDuration(iso8601: string | null): string {
  if (!iso8601) return "";
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";

  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
