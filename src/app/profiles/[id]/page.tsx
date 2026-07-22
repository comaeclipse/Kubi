"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";

import { ChannelAvatar } from "@/components/channel/channel-avatar";
import { ChannelSearch } from "@/components/channel/channel-search";
import { ChannelVideoPicker } from "@/components/channel/channel-video-picker";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { ProfileControls } from "@/components/profile/profile-controls";
import { ParentGate } from "@/components/parent/parent-gate";
import { useProfile } from "@/context/profile-context";
import { cn } from "@/lib/utils";

interface LibraryChannel {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  /** Already in the parent's family library (user_channels). */
  enabled: boolean;
}

interface YouTubeResult {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  existingChannelId: number | null;
}

// How much of an approved channel this profile may watch.
interface Approval {
  channelId: number;
  allVideos: boolean;
  selectedCount: number;
}

export default function ManageProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ParentGate>
      <ManageProfileContent params={params} />
    </ParentGate>
  );
}

function ManageProfileContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profileId = Number(use(params).id);
  const { profiles } = useProfile();
  const profile = profiles.find((p) => p.id === profileId) ?? null;

  const [channels, setChannels] = useState<LibraryChannel[]>([]);
  // Ordered, not a Set: this is the profile's own channel order, newest first.
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  // Channel whose video picker is open, or null.
  const [pickerChannelId, setPickerChannelId] = useState<number | null>(null);

  const approvedIds = useMemo(
    () => approvals.map((a) => a.channelId),
    [approvals]
  );
  const approvedSet = useMemo(() => new Set(approvedIds), [approvedIds]);
  const approvalByChannel = useMemo(
    () => new Map(approvals.map((a) => [a.channelId, a])),
    [approvals]
  );

  const loadApprovals = useCallback(async () => {
    const detail = await fetch(
      `/api/profiles/${profileId}/channels?detail=1`
    ).then((r) => r.json());
    setApprovals(Array.isArray(detail) ? detail : []);
  }, [profileId]);

  const load = useCallback(async () => {
    try {
      // `all=1` is the whole master library plus every channel this account can
      // see, each annotated with `enabled`.
      const [channelData] = await Promise.all([
        fetch("/api/channels?all=1").then((r) => r.json()),
        loadApprovals(),
      ]);
      setChannels(Array.isArray(channelData) ? channelData : []);
    } catch {
      toast.error("Couldn't load channels");
    } finally {
      setLoading(false);
    }
  }, [loadApprovals]);

  useEffect(() => {
    if (!Number.isFinite(profileId)) return;
    load();
  }, [load, profileId]);

  const channelsById = useMemo(
    () => new Map(channels.map((c) => [c.id, c])),
    [channels]
  );

  // Approved, in the profile's order. Popular is everything else, alphabetical.
  const approvedChannels = useMemo(
    () =>
      approvedIds
        .map((id) => channelsById.get(id))
        .filter((c): c is LibraryChannel => Boolean(c)),
    [approvedIds, channelsById]
  );

  const popularChannels = useMemo(
    () =>
      channels
        .filter((c) => !approvedSet.has(c.id))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [channels, approvedSet]
  );

  // Approve a channel we already hold, popping it to the front of the list.
  const approve = useCallback(
    async (channel: LibraryChannel, openPicker = false) => {
      const previousApprovals = approvals;
      const previousChannels = channels;
      setApprovals((current) => [
        { channelId: channel.id, allVideos: true, selectedCount: 0 },
        ...current.filter((a) => a.channelId !== channel.id),
      ]);

      try {
        // Granting a channel the account hasn't enabled would be rejected by
        // the PATCH below, so adopt it into the family library first.
        if (!channel.enabled) {
          const adopt = await fetch(`/api/channels/${channel.id}/toggle`, {
            method: "POST",
          });
          if (!adopt.ok) throw new Error("Failed");
          setChannels((current) =>
            current.map((c) =>
              c.id === channel.id ? { ...c, enabled: true } : c
            )
          );
        }

        const res = await fetch(`/api/profiles/${profileId}/channels`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: channel.id, allowed: true }),
        });
        if (!res.ok) throw new Error("Failed");
        if (openPicker) setPickerChannelId(channel.id);
      } catch {
        setApprovals(previousApprovals);
        setChannels(previousChannels);
        toast.error(`Couldn't approve ${channel.title}`);
      }
    },
    [approvals, channels, profileId]
  );

  // Removal happens inside the picker (tapping an approved icon opens it
  // rather than revoking, so a mis-tap can't wipe a child's channel). This
  // just reconciles local state afterwards; the channel stays in the family
  // library because siblings may still be watching it.
  const handleRemoved = useCallback((channelId: number) => {
    setApprovals((current) => current.filter((a) => a.channelId !== channelId));
  }, []);

  // Add a channel found on YouTube. If we already hold it this is a silent
  // enable — the server never re-imports a channel it already has.
  const addFromYouTube = useCallback(
    async (result: YouTubeResult) => {
      try {
        const res = await fetch(
          `/api/profiles/${profileId}/channels/youtube`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ youtubeChannelId: result.channelId }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");

        // Re-read the library so a newly created channel appears with its real
        // id and thumbnail, then pop it to the front.
        const channelData = await fetch("/api/channels?all=1").then((r) =>
          r.json()
        );
        setChannels(Array.isArray(channelData) ? channelData : []);
        setApprovals((current) => [
          { channelId: data.channel.id, allVideos: true, selectedCount: 0 },
          ...current.filter((a) => a.channelId !== data.channel.id),
        ]);

        toast.success(
          data.adopted
            ? `Added ${data.channel.title}`
            : `Added ${data.channel.title} — ${data.imported} videos ready, more syncing`
        );

        // Straight into the picker so the parent can take the whole channel or
        // narrow it down to specific videos.
        setPickerChannelId(data.channel.id);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't add that channel"
        );
      }
    },
    [profileId]
  );

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
              : `${approvedIds.length} channel${
                  approvedIds.length === 1 ? "" : "s"
                } approved`}
          </p>
        </div>
      </div>

      {profile && <ProfileControls profile={profile} />}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Add channels</h2>
        <p className="text-sm text-muted-foreground">
          Search YouTube by name. Picking a channel approves it for{" "}
          {profile?.name ?? "this profile"} straight away.
        </p>
        <ChannelSearch
          library={channels}
          approvedIds={approvedSet}
          onSelectLocal={approve}
          onSelectYouTube={addFromYouTube}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Approved channels</h2>
        <p className="text-sm text-muted-foreground">
          What {profile?.name ?? "this profile"} can watch, newest first. Tap
          one to choose videos or remove it.
        </p>
        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading…</p>
        ) : approvedChannels.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No channels approved yet. Search above, or pick from Popular
            channels below.
          </p>
        ) : (
          <ChannelGrid
            channels={approvedChannels}
            approved
            approvalByChannel={approvalByChannel}
            onSelect={(channel) => setPickerChannelId(channel.id)}
          />
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Popular channels</h2>
        <p className="text-sm text-muted-foreground">
          Channels other families use. Tap one to approve it.
        </p>
        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading…</p>
        ) : popularChannels.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Everything available is already approved.
          </p>
        ) : (
          <ChannelGrid
            channels={popularChannels}
            onSelect={(channel) => approve(channel, true)}
          />
        )}
      </div>

      <ChannelVideoPicker
        profileId={profileId}
        channelId={pickerChannelId}
        onClose={() => setPickerChannelId(null)}
        onSaved={() => loadApprovals()}
        onRemoved={handleRemoved}
      />
    </div>
  );
}

function ChannelGrid({
  channels,
  approved = false,
  approvalByChannel,
  onSelect,
}: {
  channels: LibraryChannel[];
  approved?: boolean;
  approvalByChannel?: Map<number, Approval>;
  onSelect: (channel: LibraryChannel) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] justify-items-center gap-x-3 gap-y-5">
      {channels.map((channel) => {
      const approval = approvalByChannel?.get(channel.id);
      const partial = approval ? !approval.allVideos : false;
      return (
        <button
          key={channel.id}
          type="button"
          aria-label={
            approved
              ? `${channel.title} — choose videos`
              : `Approve ${channel.title}`
          }
          onClick={() => onSelect(channel)}
          title={channel.title}
          /* Fixed to the icon's width so the label below can never be
             wider than the icon it belongs to. */
          className="group w-20 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="relative block h-20 w-20">
            <ChannelAvatar
              title={channel.title}
              thumbnailUrl={channel.thumbnailUrl}
              className={cn(
                "h-20 w-20 rounded-xl text-2xl transition-all",
                approved
                  ? "opacity-100 ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "opacity-40 grayscale group-hover:opacity-70"
              )}
            />
            {approved && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </span>
          {/* w-full == the 5rem button width == the icon width. */}
          <span
            className={cn(
              "mt-1.5 block w-full truncate text-center text-xs transition-colors",
              approved ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {channel.title}
          </span>
          {/* Only shown for pick-some channels, so "whole channel" stays the
              quiet default and a narrowed one is obvious at a glance. */}
          {partial && (
            <span className="block w-full truncate text-center text-[10px] text-muted-foreground">
              {approval?.selectedCount} video
              {approval?.selectedCount === 1 ? "" : "s"}
            </span>
          )}
        </button>
      );
      })}
    </div>
  );
}
