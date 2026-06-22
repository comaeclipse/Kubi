"use client";

import { useCallback, useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { ChannelAvatar } from "@/components/channel/channel-avatar";
import { toast } from "sonner";

interface ToggleChannel {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  enabled: boolean;
}

// Lets a parent pick which master-library channels their kids can watch.
export function ChannelToggleList() {
  const [channels, setChannels] = useState<ToggleChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/channels?all=1").then((r) => r.json());
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

  async function toggle(channel: ToggleChannel, next: boolean) {
    setBusy(channel.id);
    // Optimistic.
    setChannels((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, enabled: next } : c))
    );
    try {
      const res = await fetch(`/api/channels/${channel.id}/toggle`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      toast.error(`Couldn't update ${channel.title}`);
      // Revert.
      setChannels((prev) =>
        prev.map((c) => (c.id === channel.id ? { ...c, enabled: !next } : c))
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading channels…</p>;
  }

  if (channels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No channels are available yet. Check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Channels for your kids</h2>
      <p className="text-sm text-muted-foreground">
        Turn channels on or off. Your kids only see videos from channels you
        enable.
      </p>
      <div className="divide-y rounded-lg border">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="flex items-center gap-3 px-4 py-3"
          >
            <ChannelAvatar
              title={channel.title}
              thumbnailUrl={channel.thumbnailUrl}
              className="h-9 w-9 rounded-full text-sm shrink-0"
            />
            <span className="flex-1 text-sm font-medium">{channel.title}</span>
            <Switch
              checked={channel.enabled}
              disabled={busy === channel.id}
              onCheckedChange={(next) => toggle(channel, next)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
