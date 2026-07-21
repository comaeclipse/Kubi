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

interface Profile {
  id: number;
  name: string;
}

// Lets a parent pick which master-library channels their kids can watch.
export function ChannelToggleList() {
  const [channels, setChannels] = useState<ToggleChannel[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allowedByProfile, setAllowedByProfile] = useState<Record<number, Set<number>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [channelData, profileData] = await Promise.all([
        fetch("/api/channels?all=1").then((r) => r.json()),
        fetch("/api/profiles").then((r) => r.json()),
      ]);
      setChannels(Array.isArray(channelData) ? channelData : []);
      const nextProfiles = Array.isArray(profileData) ? profileData : [];
      setProfiles(nextProfiles);
      const accessRows = await Promise.all(
        nextProfiles.map(async (profile: Profile) => [
          profile.id,
          await fetch(`/api/profiles/${profile.id}/channels`).then((r) => r.json()),
        ] as const)
      );
      setAllowedByProfile(
        Object.fromEntries(
          accessRows.map(([profileId, channelIds]) => [
            profileId,
            new Set(Array.isArray(channelIds) ? channelIds : []),
          ])
        )
      );
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

  async function toggleProfileChannel(
    profile: Profile,
    channel: ToggleChannel,
    allowed: boolean
  ) {
    const previous = allowedByProfile[profile.id] ?? new Set<number>();
    const next = new Set(previous);
    if (allowed) next.add(channel.id);
    else next.delete(channel.id);
    setAllowedByProfile((current) => ({ ...current, [profile.id]: next }));

    try {
      const res = await fetch(`/api/profiles/${profile.id}/channels`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id, allowed }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      toast.error(`Couldn't update ${profile.name}'s access to ${channel.title}`);
      setAllowedByProfile((current) => ({ ...current, [profile.id]: previous }));
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
        Add channels to your family library, then choose which child can watch
        each one. New profiles start with no channel access.
      </p>
      <div className="divide-y rounded-lg border">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
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
            {channel.enabled && profiles.length > 0 && (
              <div className="basis-full flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 text-xs sm:pl-12">
                {profiles.map((profile) => {
                  const allowed = allowedByProfile[profile.id]?.has(channel.id) ?? false;
                  return (
                    <label key={profile.id} className="flex items-center gap-2">
                      <Switch
                        checked={allowed}
                        onCheckedChange={(next) =>
                          toggleProfileChannel(profile, channel, next)
                        }
                      />
                      <span>{profile.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
