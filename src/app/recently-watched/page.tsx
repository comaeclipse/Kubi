"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { VideoCard } from "@/components/video/video-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/context/profile-context";

interface Video {
  id: number;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration: string | null;
  channelTitle: string | null;
  channelThumbnailUrl: string | null;
  youtubeChannelId: string | null;
  progressSeconds: number | null;
}

const PAGE_SIZE = 12;

export default function RecentlyWatchedPage() {
  const { activeProfile, loading: profileLoading } = useProfile();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchVideos = useCallback(
    async (offset: number) => {
      if (!activeProfile) return;
      const res = await fetch(
        `/api/videos/recently-watched?profileId=${activeProfile.id}&limit=${PAGE_SIZE}&offset=${offset}`
      );
      if (!res.ok) return;
      return res.json() as Promise<{
        videos: Video[];
        total: number;
        hasMore: boolean;
      }>;
    },
    [activeProfile]
  );

  // Initial load
  useEffect(() => {
    if (!activeProfile) {
      setVideos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchVideos(0).then((data) => {
      if (data) {
        setVideos(data.videos);
        setHasMore(data.hasMore);
      }
      setLoading(false);
    });
  }, [activeProfile, fetchVideos]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const data = await fetchVideos(videos.length);
    if (data) {
      setVideos((prev) => [...prev, ...data.videos]);
      setHasMore(data.hasMore);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, fetchVideos, videos.length]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  if (profileLoading) {
    return null;
  }

  if (!activeProfile) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Select a profile to see your watch history.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Recently Watched</h1>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          No watch history yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <VideoCard key={video.youtubeVideoId} {...video} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {loadingMore && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
