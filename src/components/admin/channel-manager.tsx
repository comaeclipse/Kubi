"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AddChannelDialog } from "@/components/channel/add-channel-dialog";
import { History, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LabelPicker } from "@/components/admin/label-picker";
import type { Label } from "@/lib/taxonomy";

interface Channel {
  id: number;
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  source?: string | null;
  labels?: Label[];
}

interface ChannelManagerProps {
  channels: Channel[];
  onRefresh: () => void;
  labels: Label[];
}

export function ChannelManager({ channels, onRefresh, labels }: ChannelManagerProps) {
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [backfillingId, setBackfillingId] = useState<number | null>(null);
  const [backfillCount, setBackfillCount] = useState(0);
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

  // Sync only walks back as far as the newest video already stored, so it can
  // never repair a channel whose original import stopped early. This walks the
  // entire uploads playlist instead, one page of 50 per call, relying on the
  // insert's onConflictDoNothing to skip everything already present.
  async function handleBackfill(id: number, title: string) {
    if (
      !confirm(
        `Re-import the full upload history for "${title}"?\n\nThis walks every page of the channel's uploads and adds anything missing. Existing videos are left alone.`
      )
    )
      return;

    setBackfillingId(id);
    setBackfillCount(0);
    try {
      let pageToken: string | null = null;
      let total = 0;

      do {
        const res: Response = await fetch(`/api/channels/${id}/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageToken }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Import failed");
        total += data.imported;
        setBackfillCount(total);
        pageToken = data.nextPageToken ?? null;
      } while (pageToken);

      toast.success(`Re-imported ${total} video(s) from ${title}`);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-import failed");
    } finally {
      setBackfillingId(null);
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
              <LabelPicker
                labels={labels}
                assigned={channel.labels ?? []}
                compact
                onSave={async (labelIds) => {
                  const response = await fetch(`/api/channels/${channel.id}/labels`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ labelIds }),
                  });
                  if (!response.ok) throw new Error();
                  const updated = await response.json();
                  onRefresh();
                  return updated;
                }}
              />
              <Button
                variant="outline"
                size="icon"
                title="Sync new uploads"
                onClick={() => handleSync(channel.id)}
                disabled={syncingId === channel.id || backfillingId === channel.id}
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncingId === channel.id ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                variant="outline"
                size={backfillingId === channel.id ? "sm" : "icon"}
                title="Re-import full upload history"
                onClick={() => handleBackfill(channel.id, channel.title)}
                disabled={syncingId === channel.id || backfillingId === channel.id}
              >
                <History
                  className={`h-4 w-4 ${backfillingId === channel.id ? "animate-spin" : ""}`}
                />
                {backfillingId === channel.id && (
                  <span className="ml-1.5 tabular-nums">{backfillCount}</span>
                )}
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
