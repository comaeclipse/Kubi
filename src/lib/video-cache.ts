export interface Video {
  id: number;
  youtubeVideoId: string;
  youtubeChannelId: string | null;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration: string | null;
  channelTitle: string | null;
  channelThumbnailUrl: string | null;
  progressSeconds?: number | null;
}

export interface Spotlight {
  channelId: string;
  channelTitle: string;
  channelThumbnailUrl: string;
  videos: Video[];
}

export interface FeedCacheEntry {
  videos: Video[];
  spotlights: Spotlight[];
  hasMore: boolean;
  fetchedAt: number;
  total: number;
}

const TTL_MS = 30 * 60 * 1000; // 30 minutes

const cache = new Map<string, FeedCacheEntry>();

export function makeCacheKey(
  sort: string,
  profileId: number | null | undefined
): string {
  return `${sort}:${profileId ?? "none"}`;
}

export function getCacheEntry(key: string): FeedCacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

export function setCacheEntry(key: string, entry: FeedCacheEntry): void {
  cache.set(key, entry);
}

export function invalidateKey(key: string): void {
  cache.delete(key);
}
