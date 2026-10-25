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

// Where the viewer was on a channel page: the topmost visible card, how far
// from the viewport top it sat, and how many videos were loaded. Pixel
// offsets alone don't survive a revisit because the grid refetches from page
// one, so we reload that many rows and line the same card back up.
interface SavedScroll {
  anchor: string;
  top: number;
  count: number;
}

function scrollKey(channelId: string, profileId: number | undefined) {
  return `channel-scroll:${profileId ?? "none"}:${channelId}`;
}

function readSavedScroll(key: string): SavedScroll | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SavedScroll) : null;
  } catch {
    return null;
  }
}

export default function ChannelPage() {
  const params = useParams<{ channelId: string }>();
  const { activeProfile, restoring: profileRestoring } = useProfile();
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
  // Bumped by every fetch so a response that has been superseded (channel
  // switched, profile restored) can't write its rows over the newer load.
  const requestIdRef = useRef(0);
  // Mirror of `hasMore` readable synchronously inside the scroll handler so we
  // stop paging once the last page has loaded (otherwise scroll events + the
  // skeleton layout shift re-fire fetches in an infinite loop).
  const hasMoreRef = useRef(true);
  const videoCountRef = useRef(0);
  // Position to restore once the first load lands; saving stays off until
  // then so the empty mid-load page doesn't overwrite it with "top".
  const pendingRestoreRef = useRef<SavedScroll | null>(null);
  const restoredRef = useRef(false);
  const storageKey = scrollKey(params.channelId, activeProfile?.id);

  const fetchVideos = useCallback(
    async (newOffset: number, append: boolean, limit = PAGE_SIZE) => {
      // Only paging is skipped while a request is open. A fresh load has to go
      // through, or a first page that arrives mid-flight is dropped and the
      // grid is stranded empty with nothing left to retrigger it.
      if (append && (loadingRef.current || !hasMoreRef.current)) return;
      const requestId = ++requestIdRef.current;
      loadingRef.current = true;
      if (append) setLoadingMore(true);

      try {
        const pParam = activeProfile ? `&profileId=${activeProfile.id}` : "";
        const res = await fetch(
          `/api/videos?channelId=${params.channelId}&limit=${limit}&offset=${newOffset}${pParam}`
        );
        const data = await res.json();
        if (requestId !== requestIdRef.current) return;
        const newVideos = data.videos || [];

        setVideos((prev) => (append ? [...prev, ...newVideos] : newVideos));
        setHasMore(data.hasMore ?? false);
        hasMoreRef.current = data.hasMore ?? false;
        setTotalVideos(data.total ?? 0);
        offsetRef.current = newOffset + newVideos.length;
      } catch {
        // ignore
      } finally {
        if (requestId === requestIdRef.current) {
          setLoadingMore(false);
          loadingRef.current = false;
        }
      }
    },
    [params.channelId, activeProfile]
  );

  useEffect(() => {
    // Until the stored profile has been read back from localStorage there is
    // no profileId to send, and /api/videos rejects a profile-less request
    // outright — so a hard load of this page would 403 and render empty.
    if (profileRestoring) return;

    setLoading(true);
    setVideos([]);
    offsetRef.current = 0;
    setHasMore(true);
    hasMoreRef.current = true;

    const saved = readSavedScroll(storageKey);
    pendingRestoreRef.current = saved;
    restoredRef.current = false;
    // Load every row the viewer had scrolled through in one request, rounded
    // up to a whole page so paging carries on from a page boundary.
    const firstLimit = saved
      ? Math.ceil(saved.count / PAGE_SIZE) * PAGE_SIZE
      : PAGE_SIZE;

    Promise.all([
      fetch("/api/channels").then((r) => r.json()),
      fetch("/api/auth/status").then((r) => r.json()),
    ])
      .then(([channels, auth]) => {
        const ch = channels.find(
          (c: Channel) => c.youtubeChannelId === params.channelId
        );
        setChannel(ch || null);
        setIsAdmin(auth.user?.isOperator ?? false);
      })
      .catch(() => {});

    fetchVideos(0, false, Math.max(firstLimit, PAGE_SIZE)).finally(() =>
      setLoading(false)
    );
  }, [params.channelId, fetchVideos, profileRestoring, storageKey]);

  useEffect(() => {
    videoCountRef.current = videos.length;
  }, [videos]);

  // Line the saved card back up once the first load has rendered. `loading`
  // alone isn't enough: a superseded fetch still clears it while the grid is
  // empty, and the grid also waits on the channel lookup.
  useEffect(() => {
    if (loading || !channel || videos.length === 0 || restoredRef.current)
      return;
    restoredRef.current = true;
    const saved = pendingRestoreRef.current;
    pendingRestoreRef.current = null;
    if (!saved) return;
    const el = document.querySelector<HTMLElement>(
      `[data-video-id="${CSS.escape(saved.anchor)}"]`
    );
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - saved.top;
    window.scrollTo({ top: y, behavior: "instant" });
  }, [loading, channel, videos]);

  // Remember the topmost visible card as the viewer scrolls, and again on the
  // tap that opens a video so a quick scroll-then-tap isn't lost.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function save() {
      timer = undefined;
      if (!restoredRef.current) return;
      const cards = document.querySelectorAll<HTMLElement>("[data-video-id]");
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        if (rect.bottom > 0) {
          const state: SavedScroll = {
            anchor: card.dataset.videoId!,
            top: rect.top,
            count: videoCountRef.current,
          };
          try {
            if (window.scrollY === 0) sessionStorage.removeItem(storageKey);
            else sessionStorage.setItem(storageKey, JSON.stringify(state));
          } catch {
            // storage unavailable (private mode) — just don't remember
          }
          return;
        }
      }
    }
    function onScroll() {
      if (!timer) timer = setTimeout(save, 100);
    }
    function onPointerDown() {
      clearTimeout(timer);
      save();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      clearTimeout(timer);
    };
  }, [storageKey]);

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
            <div key={video.youtubeVideoId} data-video-id={video.youtubeVideoId}>
              <VideoCard {...video} />
            </div>
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
