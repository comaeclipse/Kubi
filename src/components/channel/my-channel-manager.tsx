"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChannelAvatar } from "@/components/channel/channel-avatar";
import { toast } from "sonner";
import { Plus, Loader2, Trash2 } from "lucide-react";

interface MyChannel {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  youtubeChannelId: string;
  videoCount: number;
}

const MAX_PRIVATE_CHANNELS = 25;

// Lets any signed-in parent add their own YouTube channels, visible only to
// their account. Mirrors the operator add-channel flow (create record, then
// loop the paginated import) but scoped to /api/my-channels.
export function MyChannelManager() {
  const [channels, setChannels] = useState<MyChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [removing, setRemoving] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/my-channels").then((r) => r.json());
      setChannels(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const atCap = channels.length >= MAX_PRIVATE_CHANNELS;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || adding || atCap) return;

    setAdding(true);
    setImportedCount(0);
    try {
      // Step 1: create the private channel record.
      const res = await fetch("/api/my-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add channel");

      const channelId: number = data.channel.id;

      // Step 2: paginated import — one page of 50 videos per call.
      let pageToken: string | null = null;
      let total = 0;
      do {
        const importRes: Response = await fetch(
          `/api/my-channels/${channelId}/import`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageToken }),
          }
        );
        const importData = await importRes.json();
        if (!importRes.ok) throw new Error(importData.error || "Import failed");
        total += importData.imported;
        setImportedCount(total);
        pageToken = importData.nextPageToken ?? null;
      } while (pageToken);

      setInput("");
      toast.success(`Added ${data.channel.title}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add channel");
    } finally {
      setAdding(false);
      setImportedCount(0);
    }
  }

  async function handleRemove(channel: MyChannel) {
    if (
      !confirm(
        `Remove "${channel.title}"? This deletes its videos from your account.`
      )
    ) {
      return;
    }
    setRemoving(channel.id);
    try {
      const res = await fetch(`/api/my-channels/${channel.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Removed ${channel.title}`);
      await load();
    } catch {
      toast.error(`Couldn't remove ${channel.title}`);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Your channels</h2>
        <p className="text-sm text-muted-foreground">
          Add your own YouTube channels — visible only to your account.{" "}
          {channels.length} / {MAX_PRIVATE_CHANNELS} channels.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          placeholder="YouTube URL, @handle, or channel ID"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={adding || atCap}
        />
        <Button type="submit" disabled={adding || atCap || !input.trim()}>
          {adding ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </>
          )}
        </Button>
      </form>

      {adding && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>
            Importing videos…{" "}
            {importedCount > 0 ? `${importedCount} imported so far` : "starting…"}
          </span>
        </div>
      )}

      {atCap && !adding && (
        <p className="text-sm text-muted-foreground">
          You&apos;ve reached the limit. Remove a channel to add another.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-2">Loading…</p>
      ) : channels.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No channels yet. Add a YouTube channel above to get started.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center gap-3 px-4 py-3">
              <ChannelAvatar
                title={channel.title}
                thumbnailUrl={channel.thumbnailUrl}
                className="h-9 w-9 rounded-full text-sm shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{channel.title}</p>
                <p className="text-xs text-muted-foreground">
                  {channel.videoCount} video{channel.videoCount === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(channel)}
                disabled={removing === channel.id}
                title="Remove channel"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
