"use client";

import { useCallback, useEffect, useState } from "react";
import { Scan, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { ChannelManager } from "@/components/admin/channel-manager";
import { BunnyChannelManager } from "@/components/admin/bunny-channel-manager";
import { PlaylistManager } from "@/components/admin/playlist-manager";
import { AdminVideoCard } from "@/components/admin/admin-video-card";
import { CronStatus } from "@/components/admin/cron-status";
import { OperatorGuard } from "@/components/admin/operator-guard";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Label } from "@/lib/taxonomy";

interface Channel {
  id: number;
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  source?: string | null;
  bunnyLibraryId?: string | null;
  bunnyCdnHostname?: string | null;
  bunnyCoverVideoId?: string | null;
  labels?: Label[];
}

interface Video {
  id: number;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration: string | null;
  hidden: boolean;
  isShort: boolean;
  channelId: number;
  channelTitle: string | null;
  labels?: Label[];
}

function MasterLibrary() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [shortsExpanded, setShortsExpanded] = useState(false);
  const [sharedPlaylists, setSharedPlaylists] = useState<
    { id: number; name: string; profileId: number | null; videoCount: number }[]
  >([]);
  const [labels, setLabels] = useState<Label[]>([]);

  const loadLabels = useCallback(async () => {
    try {
      const data = await fetch("/api/labels").then((response) =>
        response.json()
      );
      setLabels(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  const loadPlaylists = useCallback(async () => {
    try {
      const data = await fetch("/api/playlists").then((r) => r.json());
      const all = Array.isArray(data) ? data : [];
      setSharedPlaylists(
        all.filter((p: { profileId: number | null }) => p.profileId === null)
      );
    } catch {
      // ignore
    }
  }, []);

  // Load the full master library (operators manage all channels/videos).
  const loadChannels = useCallback(async () => {
    try {
      const data = await fetch("/api/channels?all=1").then((r) => r.json());
      setChannels(data);
      return data as Channel[];
    } catch {
      return [] as Channel[];
    }
  }, []);

  // Load videos for a specific channel only
  const loadVideos = useCallback(async (channelId: string) => {
    if (channelId === "all") {
      setVideos([]);
      return;
    }
    setVideosLoading(true);
    try {
      const data = await fetch(
        `/api/videos?all=1&channelId=${channelId}&includeHidden=true&includeShorts=true`
      ).then((r) => r.json());
      setVideos(Array.isArray(data) ? data : (data.videos ?? []));
    } catch {
      // ignore
    } finally {
      setVideosLoading(false);
    }
  }, []);

  // Called by ChannelManager after add/sync/delete.
  // Reloads the channel list, then refreshes videos if the selected channel
  // still exists (handles the case where the selected channel was deleted).
  const handleChannelRefresh = useCallback(async () => {
    const updated = await loadChannels();
    if (selectedChannel !== "all") {
      const stillExists = updated.some(
        (ch) => ch.id.toString() === selectedChannel
      );
      if (stillExists) {
        loadVideos(selectedChannel);
      } else {
        setSelectedChannel("all");
        setVideos([]);
      }
    }
  }, [loadChannels, loadVideos, selectedChannel]);

  useEffect(() => {
    loadChannels();
    loadPlaylists();
    loadLabels();
  }, [loadChannels, loadPlaylists, loadLabels]);

  // Fetch videos whenever the selected channel changes.
  useEffect(() => {
    loadVideos(selectedChannel);
  }, [selectedChannel, loadVideos]);

  async function handleToggleHidden(id: number, hidden: boolean) {
    try {
      const res = await fetch(`/api/videos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      if (!res.ok) throw new Error("Failed to update");
      // Optimistic update — no refetch needed
      setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, hidden } : v)));
    } catch {
      toast.error("Failed to update video visibility");
    }
  }

  // Walks the library one batch at a time. The route reclassifies a fixed
  // number of videos per call and hands back a cursor, so a large library can't
  // push a single request past the function timeout.
  async function handleScanShorts() {
    setScanning(true);
    setScanProgress(0);
    try {
      let cursor: number | null = null;
      let scanned = 0;
      let shortsFound = 0;
      let changed = 0;

      do {
        const res: Response = await fetch("/api/admin/scan-shorts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cursor === null ? {} : { cursor }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        scanned += data.scanned;
        shortsFound += data.shortsFound;
        changed += data.changed;
        cursor = data.nextCursor;
        setScanProgress(scanned);
      } while (cursor !== null);

      toast.success(
        `Scanned ${scanned} videos — ${shortsFound} Short${shortsFound !== 1 ? "s" : ""}, ${changed} reclassified`
      );
      // Only reload videos for the currently-selected channel, not everything
      await loadVideos(selectedChannel);
      if (shortsFound > 0) setShortsExpanded(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  const shorts = videos.filter((v) => v.isShort);
  const regularVideos = videos.filter((v) => !v.isShort);

  const filteredVideos = regularVideos.filter(
    (v) =>
      !searchQuery || v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredShorts = shorts.filter(
    (v) =>
      !searchQuery || v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Operator tools — channels and videos here are available for every account
        to enable.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left column — Channels */}
        <div className="space-y-6">
          <ChannelManager
            channels={channels}
            labels={labels}
            onRefresh={handleChannelRefresh}
          />

          <Separator />

          <BunnyChannelManager
            channels={channels}
            labels={labels}
            onRefresh={handleChannelRefresh}
          />

          <Separator />

          <CronStatus />
        </div>

        {/* Right column — Video Management */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Video Management</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleScanShorts}
              disabled={scanning}
            >
              <Scan
                className={`h-4 w-4 mr-1.5 ${scanning ? "animate-pulse" : ""}`}
              />
              {scanning
                ? scanProgress > 0
                  ? `Scanning… ${scanProgress}`
                  : "Scanning…"
                : "Scan for Shorts"}
            </Button>
          </div>

          <div className="flex gap-3">
            <Input
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
              disabled={selectedChannel === "all"}
            />
            <Select
              value={selectedChannel}
              onValueChange={(val) => {
                setSelectedChannel(val);
                setSearchQuery("");
                setShortsExpanded(false);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id.toString()}>
                    {ch.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <PlaylistManager
            playlists={sharedPlaylists}
            onRefresh={loadPlaylists}
          />

          <Separator />

          {selectedChannel === "all" ? (
            <p className="text-sm text-muted-foreground py-4">
              Select a channel above to manage its videos.
            </p>
          ) : videosLoading ? (
            <p className="text-sm text-muted-foreground py-4">
              Loading videos…
            </p>
          ) : (
            <>
              {/* Shorts section — collapsible */}
              {filteredShorts.length > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20">
                  <button
                    onClick={() => setShortsExpanded((e) => !e)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left"
                  >
                    {shortsExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <span className="font-medium text-sm">YouTube Shorts</span>
                    <Badge variant="secondary" className="ml-1">
                      {filteredShorts.length}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-1">
                      hidden from kids view by default
                    </span>
                  </button>
                  {shortsExpanded && (
                    <div className="px-4 pb-4 space-y-2">
                      {filteredShorts.map((video) => (
                        <AdminVideoCard
                          key={video.id}
                          {...video}
                          labels={labels}
                          assignedLabels={video.labels}
                          onLabelsChanged={() => loadVideos(selectedChannel)}
                          onToggleHidden={handleToggleHidden}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Regular videos */}
              <div className="space-y-2">
                {filteredVideos.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No videos found
                  </p>
                ) : (
                  filteredVideos.map((video) => (
                    <AdminVideoCard
                      key={video.id}
                      {...video}
                      labels={labels}
                      assignedLabels={video.labels}
                      onLabelsChanged={() => loadVideos(selectedChannel)}
                      onToggleHidden={handleToggleHidden}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminLibraryPage() {
  return (
    <OperatorGuard>
      <MasterLibrary />
    </OperatorGuard>
  );
}
