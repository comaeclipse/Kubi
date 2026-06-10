"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AddChannelDialog } from "@/components/channel/add-channel-dialog";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Channel {
  id: number;
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  source?: string | null;
}

interface ChannelManagerProps {
  channels: Channel[];
  onRefresh: () => void;
}

export function ChannelManager({ channels, onRefresh }: ChannelManagerProps) {
  const [syncingId, setSyncingId] = useState<number | null>(null);
  // Bunny channels are managed separately in BunnyChannelManager.
  const youtubeChannels = channels.filter((c) => c.source !== "bunny");

  async function handleSync(id: number) {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/channels/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Synced ${data.newVideoCount} new video(s)`);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleRemove(id: number) {
    if (!confirm("Remove this channel and all its videos?")) return;
    try {
      const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove channel");
      toast.success("Channel removed");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Channels</h2>
        <AddChannelDialog onAdded={onRefresh} />
      </div>

      {youtubeChannels.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          No channels added yet. Click &quot;Add Channel&quot; to get started.
        </p>
      )}

      <div className="space-y-2">
        {youtubeChannels.map((channel) => (
          <Card key={channel.id}>
            <CardContent className="flex items-center gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={channel.thumbnailUrl ?? ""}
                alt={channel.title}
                className="h-10 w-10 rounded-full object-cover shrink-0"
                loading="lazy"
              />
              <span className="flex-1 font-medium truncate">
                {channel.title}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleSync(channel.id)}
                disabled={syncingId === channel.id}
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncingId === channel.id ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleRemove(channel.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
