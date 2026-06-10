"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { VideoGrid } from "@/components/video/video-grid";
import { VideoCard } from "@/components/video/video-card";
import { ChannelAvatar } from "@/components/channel/channel-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Clock, Shuffle, RefreshCw } from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { useVideoFeed } from "@/hooks/use-video-feed";

interface Channel {
  id: number;
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string;
}

const PAGE_SIZE = 12;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function HomeContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";

  const { activeProfile } = useProfile();
  const [sort, setSort] = useState<"recent" | "random">("random");
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { videos, spotlights, loading, loadingMore, loadMore, refresh } =
    useVideoFeed(sort, activeProfile, query);

  // Fetch channels once for the quick-pick row
  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((data: Channel[]) => setAllChannels(shuffleArray(data).slice(0, 5)))
      .catch(() => {});
  }, []);

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

  // Interleave spotlight rows after every 12 videos
  function renderContent() {
    const rows: React.ReactNode[] = [];
    let spotlightIndex = 0;

    for (let i = 0; i < videos.length; i += PAGE_SIZE) {
      const chunk = videos.slice(i, i + PAGE_SIZE);
      rows.push(
        <div
          key={`grid-${i}`}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {chunk.map((video) => (
            <VideoCard key={video.youtubeVideoId} {...video} />
          ))}
        </div>
      );

      // Insert a spotlight row after each batch (if available, only when not searching)
      if (
        !query &&
        spotlights.length > 0 &&
        spotlightIndex < spotlights.length &&
        i + PAGE_SIZE < videos.length
      ) {
        const spotlight = spotlights[spotlightIndex % spotlights.length];
        rows.push(
          <div
            key={`spotlight-${spotlightIndex}`}
            className="py-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <ChannelAvatar
                title={spotlight.channelTitle ?? ""}
                thumbnailUrl={spotlight.channelThumbnailUrl}
                className="h-8 w-8 rounded-full shrink-0 text-sm"
              />
              <Link
                href={`/channel/${spotlight.channelId}`}
                className="font-semibold hover:underline"
              >
                {spotlight.channelTitle}
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {spotlight.videos.map((video) => (
                <VideoCard
                  key={`sp-${video.youtubeVideoId}`}
                  {...video}
                  youtubeChannelId={spotlight.channelId}
                  channelTitle={spotlight.channelTitle}
                />
              ))}
            </div>
          </div>
        );
        spotlightIndex++;
      }
    }

    return rows;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {query ? `Results for "${query}"` : "Videos"}
        </h1>
        {!query && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh videos"
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
            <div className="flex items-center bg-muted rounded-full p-1">
              <button
                onClick={() => setSort("recent")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  sort === "recent"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Recent
              </button>
              <button
                onClick={() => setSort("random")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  sort === "random"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Shuffle className="h-3.5 w-3.5" />
                Random
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick channel picks — mobile only, hidden during search */}
      {!query && allChannels.length > 0 && (
        <div className="flex items-center justify-center gap-4 sm:hidden">
          {allChannels.map((ch) => (
            <Link
              key={ch.youtubeChannelId}
              href={`/channel/${ch.youtubeChannelId}`}
              title={ch.title}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ch.thumbnailUrl}
                alt={ch.title}
                className="h-[50px] w-[50px] rounded-full object-cover ring-2 ring-transparent hover:ring-primary transition-all"
                loading="lazy"
              />
            </Link>
          ))}
        </div>
      )}

      {loading ? (
        <VideoGrid videos={[]} loading />
      ) : videos.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          {query
            ? `No videos found for "${query}"`
            : "No videos yet."}
        </div>
      ) : (
        <div className="space-y-6">
          {renderContent()}
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

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
