"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import { X, Play } from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { isoToSeconds, formatDuration } from "@/lib/youtube";

interface ContinueWatchingVideo {
  youtubeVideoId: string;
  publicId: string | null;
  progressSeconds: number;
  title: string;
  thumbnailUrl: string;
  duration: string | null;
  channelTitle: string | null;
  youtubeChannelId: string | null;
}

function formatProgress(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ContinueWatchingPip() {
  const { activeProfile } = useProfile();
  const pathname = usePathname();
  const [video, setVideo] = useState<ContinueWatchingVideo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  const currentlyWatchingId = pathname.startsWith("/watch/")
    ? pathname.split("/watch/")[1]
    : null;

  const fetchContinueWatching = useCallback(async () => {
    if (!activeProfile) {
      setVideo(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/videos/continue-watching?profileId=${activeProfile.id}`
      );
      const data = await res.json();
      setVideo(data);
    } catch {
      setVideo(null);
    }
  }, [activeProfile]);

  useEffect(() => {
    fetchContinueWatching();
  }, [fetchContinueWatching, pathname]);

  useEffect(() => {
    setDismissed(false);
  }, [activeProfile?.id]);

  // Animate in after data loads
  useEffect(() => {
    if (video && !dismissed && currentlyWatchingId !== (video.publicId ?? video.youtubeVideoId)) {
      const timer = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(timer);
    }
    setVisible(false);
  }, [video, dismissed, currentlyWatchingId]);

  if (
    !video ||
    dismissed ||
    currentlyWatchingId === (video.publicId ?? video.youtubeVideoId)
  ) {
    return null;
  }

  const totalSeconds = video.duration ? isoToSeconds(video.duration) : 0;
  const progressPercent =
    totalSeconds > 0
      ? Math.min((video.progressSeconds / totalSeconds) * 100, 100)
      : 0;
  const formattedDuration = formatDuration(video.duration);
  const formattedProgress = formatProgress(video.progressSeconds);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-72 rounded-xl overflow-hidden shadow-2xl border bg-background transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0"
      }`}
    >
      <div className="relative">
        <Link href={`/watch/${(video.publicId ?? video.youtubeVideoId)}`}>
          <div className="relative aspect-video w-full bg-muted group cursor-pointer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="h-10 w-10 text-white fill-white" />
            </div>
            {formattedDuration && (
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                {formattedProgress} / {formattedDuration}
              </span>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
            <div
              className="h-full bg-red-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <Link
        href={`/watch/${(video.publicId ?? video.youtubeVideoId)}`}
        className="block px-3 py-2"
      >
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
          Continue watching
        </p>
        <p className="text-sm font-medium leading-tight line-clamp-1">
          {video.title}
        </p>
        {video.channelTitle && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {video.channelTitle}
          </p>
        )}
      </Link>
    </div>
  );
}
