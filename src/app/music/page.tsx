"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Music2, RefreshCw } from "lucide-react";

import {
  MusicPlayer,
  type MusicQueueItem,
} from "@/components/music/music-player";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProfile } from "@/context/profile-context";

const BATCH_SIZE = 20;
const REFILL_THRESHOLD = 5;
const EXCLUSION_WINDOW = 200;

export default function MusicPage() {
  const { activeProfile } = useProfile();
  const [current, setCurrent] = useState<MusicQueueItem | null>(null);
  const [upcoming, setUpcoming] = useState<MusicQueueItem[]>([]);
  const [history, setHistory] = useState<MusicQueueItem[]>([]);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refillingRef = useRef(false);
  const pendingAdvanceRef = useRef(false);
  const seenIdsRef = useRef<number[]>([]);

  const requestQueue = useCallback(async (excludeVideoIds: number[]) => {
    const response = await fetch("/api/music/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limit: BATCH_SIZE,
        profileId: activeProfile?.id,
        excludeVideoIds: excludeVideoIds.slice(-EXCLUSION_WINDOW),
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to load music");
    }
    return response.json() as Promise<{
      videos: MusicQueueItem[];
      eligibleCount: number;
    }>;
  }, [activeProfile?.id]);

  const loadInitialQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await requestQueue([]);
      setEligibleCount(data.eligibleCount);
      setCurrent(data.videos[0] ?? null);
      setUpcoming(data.videos.slice(1));
      setHistory([]);
      seenIdsRef.current = data.videos.map((video) => video.id);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load music"
      );
    } finally {
      setLoading(false);
    }
  }, [requestQueue]);

  useEffect(() => {
    loadInitialQueue();
  }, [loadInitialQueue]);

  const refill = useCallback(async () => {
    if (refillingRef.current) return;
    refillingRef.current = true;
    try {
      const addFetchedVideos = (videos: MusicQueueItem[]) => {
        if (pendingAdvanceRef.current && videos.length > 0) {
          pendingAdvanceRef.current = false;
          const [next, ...rest] = videos;
          if (current) {
            setHistory((previous) => [...previous.slice(-49), current]);
          }
          setCurrent(next);
          setUpcoming((previous) => [...previous, ...rest]);
          return;
        }
        setUpcoming((previous) => [...previous, ...videos]);
      };

      const data = await requestQueue(seenIdsRef.current);
      if (data.videos.length === 0 && data.eligibleCount > 0) {
        const activeIds = [
          ...(current ? [current.id] : []),
          ...upcoming.map((video) => video.id),
        ];
        const retry = await requestQueue(activeIds);
        seenIdsRef.current = activeIds;
        addFetchedVideos(retry.videos);
        seenIdsRef.current.push(...retry.videos.map((video) => video.id));
      } else {
        addFetchedVideos(data.videos);
        seenIdsRef.current.push(...data.videos.map((video) => video.id));
      }
      seenIdsRef.current = seenIdsRef.current.slice(-EXCLUSION_WINDOW);
    } catch {
      // Keep the existing queue playable; the next transition retries.
    } finally {
      refillingRef.current = false;
    }
  }, [current, requestQueue, upcoming]);

  useEffect(() => {
    if (current && upcoming.length <= REFILL_THRESHOLD) {
      refill();
    }
  }, [current, refill, upcoming.length]);

  const playNext = useCallback(() => {
    if (upcoming.length === 0) {
      pendingAdvanceRef.current = true;
      refill();
      return;
    }
    const [next, ...rest] = upcoming;
    if (current) {
      setHistory((previous) => [...previous.slice(-49), current]);
    }
    setCurrent(next);
    setUpcoming(rest);
  }, [current, refill, upcoming]);

  const playPrevious = useCallback(() => {
    if (history.length === 0 || !current) return;
    const previous = history[history.length - 1];
    setHistory((items) => items.slice(0, -1));
    setUpcoming((items) => [current, ...items]);
    setCurrent(previous);
  }, [current, history]);

  const playUpcoming = useCallback(
    (index: number) => {
      const selected = upcoming[index];
      if (!selected || !current) return;

      const traversed = [current, ...upcoming.slice(0, index)];
      setHistory((previous) => [...previous, ...traversed].slice(-50));
      setCurrent(selected);
      setUpcoming(upcoming.slice(index + 1));
    },
    [current, upcoming]
  );

  async function reshuffle() {
    setLoading(true);
    setError("");
    try {
      const data = await requestQueue(current ? [current.id] : []);
      setEligibleCount(data.eligibleCount);
      setHistory([]);
      setCurrent(data.videos[0] ?? current);
      setUpcoming(data.videos.slice(1));
      seenIdsRef.current = [
        ...(current ? [current.id] : []),
        ...data.videos.map((video) => video.id),
      ];
    } catch (shuffleError) {
      setError(
        shuffleError instanceof Error
          ? shuffleError.message
          : "Failed to reshuffle"
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading && !current) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Loading music…
      </div>
    );
  }

  if (!current) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-20 text-center">
        <Music2 className="h-14 w-14 text-muted-foreground" />
        <h1 className="text-2xl font-bold">No Music is tagged yet</h1>
        <p className="text-muted-foreground">
          An operator can assign the Music category to a channel or individual
          video from Manage.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button variant="outline" onClick={loadInitialQueue}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Music2 className="h-6 w-6" />
            Music
          </h1>
          <p className="text-sm text-muted-foreground">
            Shuffling {eligibleCount} approved music video
            {eligibleCount === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="outline" onClick={reshuffle} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Reshuffle
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <MusicPlayer
          key="persistent-music-player"
          track={current}
          hasPrevious={history.length > 0}
          onPrevious={playPrevious}
          onNext={playNext}
          onEnded={playNext}
          onError={playNext}
        />

        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 font-semibold">Up next</h2>
            <div className="space-y-3">
              {upcoming.slice(0, 8).map((track, index) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => playUpcoming(index)}
                  className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Play ${track.title} by ${track.channelTitle}`}
                >
                  <span className="w-5 text-center text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  {track.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={track.thumbnailUrl}
                      alt=""
                      className="h-12 w-20 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-12 w-20 rounded bg-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium">
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {track.channelTitle}
                    </p>
                  </div>
                </button>
              ))}
              {upcoming.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Finding more music…
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
