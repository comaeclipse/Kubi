import { useEffect, useState, useRef, useCallback } from "react";
import type { Profile } from "@/context/profile-context";
import {
  type Video,
  type Spotlight,
  makeCacheKey,
  getCacheEntry,
  setCacheEntry,
  invalidateKey,
} from "@/lib/video-cache";

const PAGE_SIZE = 12;

export function useVideoFeed(
  sort: "recent" | "random",
  activeProfile: Profile | null,
  query: string = ""
) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const offsetRef = useRef(0);

  const isSearching = query.trim().length > 0;
  const cacheKey = makeCacheKey(sort, activeProfile?.id);

  const fetchVideos = useCallback(
    async (newOffset: number) => {
      const pParam = activeProfile ? `&profileId=${activeProfile.id}` : "";
      const qParam = isSearching ? `&q=${encodeURIComponent(query)}` : "";
      const res = await fetch(
        `/api/videos?limit=${PAGE_SIZE}&offset=${newOffset}&sort=${sort}${pParam}${qParam}`
      );
      const data = await res.json();
      const newVideos: Video[] = data.videos || [];

      return { newVideos, hasMore: data.hasMore ?? false, total: data.total ?? 0 };
    },
    [sort, activeProfile, query, isSearching]
  );

  const fetchSpotlights = useCallback(async (): Promise<Spotlight[]> => {
    const pParam = activeProfile ? `?profileId=${activeProfile.id}` : "";
    const res = await fetch(`/api/videos/spotlight${pParam}`);
    return res.json();
  }, [activeProfile]);

  // Initial load / sort+profile+query change
  useEffect(() => {
    // Only use cache for non-search browsing
    if (!isSearching) {
      const cached = getCacheEntry(cacheKey);
      if (cached) {
        setVideos(cached.videos);
        setSpotlights(cached.spotlights);
        setHasMore(cached.hasMore);
        offsetRef.current = cached.videos.length;
        setLoading(false);
        return;
      }
    }

    offsetRef.current = 0;
    let cancelled = false;
    setLoading(true);

    if (isSearching) {
      setSpotlights([]);
      fetchVideos(0)
        .then((videoResult) => {
          if (cancelled) return;
          setVideos(videoResult.newVideos);
          setHasMore(videoResult.hasMore);
          offsetRef.current = videoResult.newVideos.length;
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      Promise.all([fetchVideos(0), fetchSpotlights()])
        .then(([videoResult, spotlightResult]) => {
          if (cancelled) return;
          setVideos(videoResult.newVideos);
          setSpotlights(spotlightResult);
          setHasMore(videoResult.hasMore);
          offsetRef.current = videoResult.newVideos.length;

          setCacheEntry(cacheKey, {
            videos: videoResult.newVideos,
            spotlights: spotlightResult,
            hasMore: videoResult.hasMore,
            fetchedAt: Date.now(),
            total: videoResult.total,
          });
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [cacheKey, fetchVideos, fetchSpotlights, refreshToken, isSearching]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);

    fetchVideos(offsetRef.current)
      .then((result) => {
        setVideos((prev) => {
          const updated = [...prev, ...result.newVideos];
          if (!isSearching) {
            const cached = getCacheEntry(cacheKey);
            if (cached) {
              setCacheEntry(cacheKey, {
                ...cached,
                videos: updated,
                hasMore: result.hasMore,
              });
            }
          }
          return updated;
        });
        setHasMore(result.hasMore);
        offsetRef.current += result.newVideos.length;
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, loading, hasMore, fetchVideos, cacheKey, isSearching]);

  const refresh = useCallback(() => {
    invalidateKey(cacheKey);
    offsetRef.current = 0;
    setRefreshToken((t) => t + 1);
  }, [cacheKey]);

  return { videos, spotlights, loading, loadingMore, hasMore, loadMore, refresh };
}
