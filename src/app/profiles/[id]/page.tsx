"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Search, X } from "lucide-react";
import { toast } from "sonner";

import { ChannelAvatar } from "@/components/channel/channel-avatar";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/context/profile-context";
import { cn } from "@/lib/utils";

interface LibraryChannel {
  id: number;
  title: string;
  thumbnailUrl: string | null;
}

export default function ManageProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profileId = Number(use(params).id);
  const { profiles } = useProfile();
  const profile = profiles.find((p) => p.id === profileId) ?? null;

  const [channels, setChannels] = useState<LibraryChannel[]>([]);
  const [approved, setApproved] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      // The family library only — the API refuses to grant a channel the
      // parent hasn't enabled for the account.
      const [channelData, approvedIds] = await Promise.all([
        fetch("/api/channels").then((r) => r.json()),
        fetch(`/api/profiles/${profileId}/channels`).then((r) => r.json()),
      ]);
      setChannels(Array.isArray(channelData) ? channelData : []);
      setApproved(new Set(Array.isArray(approvedIds) ? approvedIds : []));
    } catch {
      toast.error("Couldn't load channels");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (!Number.isFinite(profileId)) return;
    load();
  }, [load, profileId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) => c.title.toLowerCase().includes(q));
  }, [channels, query]);

  async function toggleChannel(channel: LibraryChannel) {
    const allow = !approved.has(channel.id);
    const previous = approved;
    const next = new Set(previous);
    if (allow) next.add(channel.id);
    else next.delete(channel.id);
    setApproved(next);

    try {
      const res = await fetch(`/api/profiles/${profileId}/channels`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id, allowed: allow }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setApproved(previous);
      toast.error(`Couldn't update access to ${channel.title}`);
    }
  }

  if (profiles.length > 0 && !profile) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center text-muted-foreground">
        <p>That profile doesn&apos;t exist.</p>
        <Link href="/profiles" className="mt-2 inline-block underline">
          Back to profiles
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/profiles"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Profiles
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {profile && (
          <ProfileAvatar
            name={profile.name}
            avatarColor={profile.avatarColor}
            size="lg"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold">{profile?.name ?? "Profile"}</h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading channels…"
              : `${approved.size} of ${channels.length} channel${
                  channels.length === 1 ? "" : "s"
                } approved`}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Approved channels</h2>
        <p className="text-sm text-muted-foreground">
          Tap a channel to approve it. Greyed-out channels are hidden from{" "}
          {profile?.name ?? "this profile"}.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search channels…"
          className="h-9 pl-8 pr-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading channels…</p>
      ) : channels.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">
          Your family library is empty, so there&apos;s nothing to approve yet.
        </p>
      ) : visible.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">
          No channels match “{query}”.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] justify-items-center gap-y-5 gap-x-3">
          {visible.map((channel) => {
            const isApproved = approved.has(channel.id);
            return (
              <button
                key={channel.id}
                type="button"
                role="switch"
                aria-checked={isApproved}
                onClick={() => toggleChannel(channel)}
                title={channel.title}
                /* Fixed to the icon's width so the label below can never be
                   wider than the icon it belongs to. */
                className="group w-20 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="relative block h-20 w-20">
                  <ChannelAvatar
                    title={channel.title}
                    thumbnailUrl={channel.thumbnailUrl}
                    className={cn(
                      "h-20 w-20 rounded-xl text-2xl transition-all",
                      isApproved
                        ? "opacity-100 ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "opacity-40 grayscale group-hover:opacity-70"
                    )}
                  />
                  {isApproved && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </span>
                {/* w-full == the 5rem button width == the icon width. */}
                <span
                  className={cn(
                    "mt-1.5 block w-full truncate text-center text-xs transition-colors",
                    isApproved ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {channel.title}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
