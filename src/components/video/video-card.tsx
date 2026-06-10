"use client";

import Link from "next/link";
import { useState } from "react";
import { Film } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDuration, isoToSeconds } from "@/lib/youtube";

interface VideoCardProps {
  id: number;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration: string | null;
  channelTitle?: string | null;
  channelThumbnailUrl?: string | null;
  youtubeChannelId?: string | null;
  progressSeconds?: number | null;
}

export function VideoCard({
  youtubeVideoId,
  title,
  thumbnailUrl,
  publishedAt,
  duration,
  channelTitle,
  youtubeChannelId,
  progressSeconds,
}: VideoCardProps) {
  const [imgError, setImgError] = useState(false);
  const formattedDuration = formatDuration(duration);
  const timeAgo = getTimeAgo(publishedAt);
  const totalSeconds = duration ? isoToSeconds(duration) : 0;
  const progressPercent =
    progressSeconds && totalSeconds > 0
      ? Math.min((progressSeconds / totalSeconds) * 100, 100)
      : 0;

  return (
    <Link href={`/watch/${youtubeVideoId}`} className="group block">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
        {thumbnailUrl && !imgError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumbnailUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        {formattedDuration && (
          <Badge
            variant="secondary"
            className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-mono"
          >
            {formattedDuration}
          </Badge>
        )}
        {progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
            <div
              className="h-full bg-red-600"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary">
          {title}
        </h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {channelTitle && youtubeChannelId && (
            <Link
              href={`/channel/${youtubeChannelId}`}
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {channelTitle}
            </Link>
          )}
          {channelTitle && !youtubeChannelId && <span>{channelTitle}</span>}
          {channelTitle && <span>·</span>}
          <span>{timeAgo}</span>
        </div>
      </div>
    </Link>
  );
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "week", seconds: 604800 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
}
