"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { ChannelHeader } from "@/components/channel/channel-header";
import { VideoGrid } from "@/components/video/video-grid";
import { VideoCard } from "@/components/video/video-card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useProfile } from "@/context/profile-context";

interface Channel {
  id: number;
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  uploadsPlaylistId: string | null;
  source?: string | null;
}

interface Video {
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

const PAGE_SIZE = 12;
const SCROLL_THRESHOLD = 400;

export default function ChannelPage() {
  const params = useParams<{ channelId: string }>();
  const { activeProfile } = useProfile();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  // Mirror of `hasMore` readable synchronously inside the scroll handler so we
  // stop paging once the last page has loaded (otherwise scroll events + the
  // skeleton layout shift re-fire fetches in an infinite loop).
  const hasMoreRef = useRef(true);

  const fetchVideos = useCallback(
    async (newOffset: number, append: boolean) => {
      if (loadingRef.current) return;
      if (append && !hasMoreRef.current) return;
      loadingRef.current = true;
      if (append) setLoadingMore(true);

      try {
        const pParam = activeProfile ? `&profileId=${activeProfile.id}` : "";
        const res = await fetch(
          `/api/videos?channelId=${params.channelId}&limit=${PAGE_SIZE}&offset=${newOffset}${pParam}`
        );
        const data = await res.json();
        const newVideos = data.videos || [];

        setVideos((prev) => (append ? [...prev, ...newVideos] : newVideos));
        setHasMore(data.hasMore ?? false);
        hasMoreRef.current = data.hasMore ?? false;
        setTotalVideos(data.total ?? 0);
        offsetRef.current = newOffset + newVideos.length;
      } catch {
        // ignore
      } finally {
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [params.channelId, activeProfile]
  );

  useEffect(() => {
    setLoading(true);
    setVideos([]);
    offsetRef.current = 0;
    setHasMore(true);
    hasMoreRef.current = true;

    Promise.all([
      fetch("/api/channels").then((r) => r.json()),
      fetch("/api/auth/status").then((r) => r.json()),
    ])
      .then(([channels, auth]) => {
        const ch = channels.find(
          (c: Channel) => c.youtubeChannelId === params.channelId
        );
        setChannel(ch || null);
        setIsAdmin(auth.isAdmin);
      })
      .catch(() => {});

    fetchVideos(0, false).finally(() => setLoading(false));
  }, [params.channelId, fetchVideos]);

  // Scroll-based infinite loading
  useEffect(() => {
    function handleScroll() {
      if (loadingRef.current || !hasMoreRef.current) return;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - SCROLL_THRESHOLD;
      if (nearBottom) {
        fetchVideos(offsetRef.current, true);
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [fetchVideos]);

  async function handleSync() {
    if (!channel) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/channels/${channel.id}/sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Synced ${data.newVideoCount} new video(s)`);
      setVideos([]);
      offsetRef.current = 0;
      setHasMore(true);
      hasMoreRef.current = true;
      fetchVideos(0, false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleRemove() {
    if (!channel) return;
    if (!confirm("Remove this channel and all its videos?")) return;
    try {
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove");
      window.location.href = "/";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    }
  }

  if (loading) {
    return <VideoGrid videos={[]} loading />;
  }

  if (!channel) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Channel not found</p>
      </div>
    );
  }

  return (
    <div>
      <ChannelHeader
        title={channel.title}
        thumbnailUrl={channel.thumbnailUrl}
        videoCount={totalVideos}
        isAdmin={isAdmin}
        channelId={channel.id}
        onSync={handleSync}
        onRemove={handleRemove}
        syncing={syncing}
        showSync={channel.source !== "bunny"}
      />

      {videos.length === 0 ? (
        <VideoGrid videos={[]} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <VideoCard key={video.youtubeVideoId} {...video} />
          ))}
        </div>
      )}

      {loadingMore && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!hasMore && videos.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No more videos
        </p>
      )}
    </div>
  );
}
