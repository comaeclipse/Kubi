"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChannelAvatar } from "@/components/channel/channel-avatar";
import { cn } from "@/lib/utils";

interface PickerVideo {
  id: number;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  duration: string | null;
  publishedAt: string;
  source: string;
}

interface PickerData {
  channel: { id: number; title: string; thumbnailUrl: string | null };
  approved: boolean;
  allVideos: boolean;
  selectedVideoIds: number[];
  videos: PickerVideo[];
  total: number;
  hasMore: boolean;
}

// Modal for deciding how much of a channel a profile may watch: the whole
// thing (including future uploads) or a hand-picked set. Opens straight after
// adding a channel from search, and again whenever the parent taps that
// channel's icon in the approved list.
export function ChannelVideoPicker({
  profileId,
  channelId,
  onClose,
  onSaved,
  onRemoved,
}: {
  profileId: number;
  /** Null closes the modal. */
  channelId: number | null;
  onClose: () => void;
  onSaved: (summary: { allVideos: boolean; selectedCount: number }) => void;
  onRemoved: (channelId: number) => void;
}) {
  const [data, setData] = useState<PickerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<PickerVideo[]>([]);
  const [mode, setMode] = useState<"all" | "pick">("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [saving, setSaving] = useState(false);

  const open = channelId !== null;

  useEffect(() => {
    if (channelId === null) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    fetch(`/api/profiles/${profileId}/channels/${channelId}/videos`)
      .then((r) => r.json())
      .then((payload: PickerData & { error?: string }) => {
        if (cancelled) return;
        if (payload.error) {
          toast.error(payload.error);
          onClose();
          return;
        }
        setData(payload);
        setVideos(payload.videos);
        setHasMore(payload.hasMore);
        setMode(payload.allVideos ? "all" : "pick");
        setSelected(new Set(payload.selectedVideoIds));
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Couldn't load this channel's videos");
          onClose();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId, profileId, onClose]);

  const loadMore = useCallback(async () => {
    if (channelId === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/profiles/${profileId}/channels/${channelId}/videos?offset=${videos.length}`
      );
      const payload: PickerData = await res.json();
      setVideos((current) => [...current, ...payload.videos]);
      setHasMore(payload.hasMore);
    } catch {
      toast.error("Couldn't load more videos");
    } finally {
      setLoadingMore(false);
    }
  }, [channelId, profileId, videos.length, loadingMore]);

  // Tapping a tile always means "pick this one". From whole-channel mode that
  // starts a fresh selection rather than silently keeping the videos that
  // happen to be loaded — only some of a long catalogue is on screen.
  function toggleVideo(video: PickerVideo) {
    if (mode === "all") {
      setMode("pick");
      setSelected(new Set([video.id]));
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(video.id)) next.delete(video.id);
      else next.add(video.id);
      return next;
    });
  }

  async function save() {
    if (channelId === null) return;
    if (mode === "pick" && selected.size === 0) {
      toast.error("Pick at least one video, or choose the whole channel.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/profiles/${profileId}/channels/${channelId}/videos`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "all"
              ? { allVideos: true }
              : { allVideos: false, videoIds: Array.from(selected) }
          ),
        }
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed");
      onSaved({
        allVideos: mode === "all",
        selectedCount: payload.selectedCount ?? selected.size,
      });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (channelId === null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/profiles/${profileId}/channels`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, allowed: false }),
      });
      if (!res.ok) throw new Error("Failed");
      onRemoved(channelId);
      onClose();
    } catch {
      toast.error("Couldn't remove that channel");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onClose();
      }}
    >
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {data && (
              <ChannelAvatar
                title={data.channel.title}
                thumbnailUrl={data.channel.thumbnailUrl}
                className="h-9 w-9 shrink-0 rounded-full text-sm"
              />
            )}
            <span className="truncate">{data?.channel.title ?? "Loading…"}</span>
          </DialogTitle>
          <DialogDescription>
            Add the whole channel, or tap individual videos to pick just those.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "all" ? "default" : "outline"}
            onClick={() => setMode("all")}
          >
            Entire channel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "pick" ? "default" : "outline"}
            onClick={() => setMode("pick")}
          >
            Pick videos
            {mode === "pick" && selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          <span className="text-xs text-muted-foreground">
            {mode === "all"
              ? "New uploads are included automatically."
              : "Only the videos you tick. New uploads stay out."}
          </span>
        </div>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading videos…
            </div>
          ) : videos.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No videos have been imported for this channel yet. They&apos;ll
              appear here as they sync.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {videos.map((video) => {
                  const isOn = mode === "all" || selected.has(video.id);
                  return (
                    <button
                      key={video.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isOn}
                      onClick={() => toggleVideo(video)}
                      className="group rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span className="relative block aspect-video overflow-hidden rounded-lg bg-muted">
                        {video.thumbnailUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            loading="lazy"
                            className={cn(
                              "h-full w-full object-cover transition-all",
                              isOn ? "opacity-100" : "opacity-50 group-hover:opacity-80"
                            )}
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            No preview
                          </span>
                        )}
                        {isOn && (
                          <span className="absolute inset-0 flex items-center justify-center bg-primary/25">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                              <Check className="h-5 w-5" strokeWidth={3} />
                            </span>
                          </span>
                        )}
                        {video.duration && (
                          <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1 text-[10px] font-medium text-white">
                            {video.duration}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "mt-1.5 line-clamp-2 block text-xs transition-colors",
                          isOn ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {video.title}
                      </span>
                    </button>
                  );
                })}
              </div>

              {hasMore && (
                <div className="flex justify-center py-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={remove}
            disabled={saving || !data?.approved}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Remove channel
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving || loading}>
              {saving
                ? "Saving…"
                : mode === "all"
                  ? "Add entire channel"
                  : `Add ${selected.size} video${selected.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
