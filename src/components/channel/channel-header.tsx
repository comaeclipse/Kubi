"use client";


import { Button } from "@/components/ui/button";
import { ChannelAvatar } from "@/components/channel/channel-avatar";
import { RefreshCw, Trash2 } from "lucide-react";

interface ChannelHeaderProps {
  title: string;
  thumbnailUrl: string | null;
  videoCount: number;
  isAdmin?: boolean;
  channelId: number;
  onSync?: () => void;
  onRemove?: () => void;
  syncing?: boolean;
  // Bunny channels are manually managed and have no YouTube sync.
  showSync?: boolean;
}

export function ChannelHeader({
  title,
  thumbnailUrl,
  videoCount,
  isAdmin,
  onSync,
  onRemove,
  syncing,
  showSync = true,
}: ChannelHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 min-w-0">
        <ChannelAvatar
          title={title}
          thumbnailUrl={thumbnailUrl}
          className="h-12 w-12 sm:h-16 sm:w-16 rounded-full shrink-0 text-lg sm:text-2xl"
        />
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold line-clamp-2">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {videoCount} video{videoCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      {isAdmin && (
        <div className="flex gap-2 sm:ml-auto">
          {showSync && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4 mr-1" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
