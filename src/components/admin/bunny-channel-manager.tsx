"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Pencil,
  Plus,
  Trash2,
  Video,
  ImageIcon,
  Loader2,
  DownloadCloud,
} from "lucide-react";
import { toast } from "sonner";

function formatSeconds(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

interface BunnyLibraryVideo {
  guid: string;
  title: string;
  lengthSeconds: number;
  status: number;
  imported: boolean;
}

interface Channel {
  id: number;
  youtubeChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  source?: string | null;
  bunnyLibraryId?: string | null;
  bunnyCdnHostname?: string | null;
  bunnyCoverVideoId?: string | null;
}

interface BunnyVideo {
  id: number;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string | null;
}

interface BunnyChannelManagerProps {
  channels: Channel[];
  onRefresh: () => void;
}

export function BunnyChannelManager({
  channels,
  onRefresh,
}: BunnyChannelManagerProps) {
  const bunnyChannels = channels.filter((c) => c.source === "bunny");
  const [managing, setManaging] = useState<Channel | null>(null);

  async function handleRename(channel: Channel) {
    const title = prompt("Channel name", channel.title)?.trim();
    if (!title || title === channel.title) return;
    try {
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Channel renamed");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    }
  }

  async function handleDelete(channel: Channel) {
    if (!confirm(`Remove "${channel.title}" and all its videos?`)) return;
    try {
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: "DELETE",
      });
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
        <h2 className="text-lg font-semibold">Bunny Channels</h2>
        <AddBunnyChannelDialog onAdded={onRefresh} />
      </div>

      {bunnyChannels.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          No Bunny channels yet. Click &quot;Add Bunny Channel&quot; to host your
          own videos.
        </p>
      )}

      <div className="space-y-2">
        {bunnyChannels.map((channel) => (
          <Card key={channel.id}>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                {channel.thumbnailUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={channel.thumbnailUrl}
                    alt={channel.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">
                    {channel.title.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="flex-1 font-medium truncate">
                {channel.title}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setManaging(channel)}
              >
                <Video className="h-4 w-4 mr-1" />
                Videos
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleRename(channel)}
                aria-label="Rename channel"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleDelete(channel)}
                aria-label="Remove channel"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {managing && (
        <ManageVideosDialog
          channel={managing}
          open={!!managing}
          onClose={() => setManaging(null)}
          onChannelChanged={onRefresh}
        />
      )}
    </div>
  );
}

function AddBunnyChannelDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [libraryId, setLibraryId] = useState("");
  const [cdnHostname, setCdnHostname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "bunny",
          title: title.trim(),
          bunnyLibraryId: libraryId.trim(),
          bunnyCdnHostname: cdnHostname.trim(),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setTitle("");
      setLibraryId("");
      setCdnHostname("");
      setOpen(false);
      onAdded();
      toast.success("Bunny channel created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add channel");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Add Bunny Channel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Bunny Channel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Channel name</label>
            <Input
              placeholder="e.g. Family Videos"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Bunny Library ID{" "}
              <span className="text-muted-foreground font-normal">
                (optional — uses default if blank)
              </span>
            </label>
            <Input
              placeholder="e.g. 123456"
              value={libraryId}
              onChange={(e) => setLibraryId(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">
              CDN Hostname{" "}
              <span className="text-muted-foreground font-normal">
                (optional — for thumbnails)
              </span>
            </label>
            <Input
              placeholder="e.g. vz-xxxx.b-cdn.net"
              value={cdnHostname}
              onChange={(e) => setCdnHostname(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add Channel"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageVideosDialog({
  channel,
  open,
  onClose,
  onChannelChanged,
}: {
  channel: Channel;
  open: boolean;
  onClose: () => void;
  onChannelChanged: () => void;
}) {
  const [videos, setVideos] = useState<BunnyVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [bunnyVideoId, setBunnyVideoId] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(
        `/api/videos?channelId=${channel.id}&includeHidden=true&includeShorts=true`
      ).then((r) => r.json());
      setVideos(Array.isArray(data) ? data : data.videos ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [channel.id]);

  useEffect(() => {
    if (open) loadVideos();
  }, [open, loadVideos]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!bunnyVideoId.trim() || !title.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/channels/${channel.id}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bunnyVideoId: bunnyVideoId.trim(),
          title: title.trim(),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setBunnyVideoId("");
      setTitle("");
      toast.success("Video added");
      loadVideos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add video");
    } finally {
      setAdding(false);
    }
  }

  async function handleRenameVideo(video: BunnyVideo) {
    const next = prompt("Video title", video.title)?.trim();
    if (!next || next === video.title) return;
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Title updated");
      loadVideos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    }
  }

  async function handleRemoveVideo(video: BunnyVideo) {
    if (!confirm(`Remove "${video.title}"?`)) return;
    try {
      const res = await fetch(`/api/channels/${channel.id}/videos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Video removed");
      loadVideos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    }
  }

  async function handleSetCover(video: BunnyVideo) {
    try {
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bunnyCoverVideoId: video.youtubeVideoId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Channel cover set");
      onChannelChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set cover");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage videos — {channel.title}</DialogTitle>
        </DialogHeader>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => setImportOpen(true)}
        >
          <DownloadCloud className="h-4 w-4 mr-1.5" />
          Import from Bunny library
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or add manually
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleAdd} className="space-y-2">
          <Input
            placeholder="Bunny video ID (GUID)"
            value={bunnyVideoId}
            onChange={(e) => setBunnyVideoId(e.target.value)}
            disabled={adding}
          />
          <div className="flex gap-2">
            <Input
              placeholder="Video title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={adding}
            />
            <Button
              type="submit"
              disabled={adding || !bunnyVideoId.trim() || !title.trim()}
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>

        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : videos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No videos yet. Add one by its Bunny video ID above.
            </p>
          ) : (
            videos.map((video) => (
              <Card key={video.id}>
                <CardContent className="flex items-center gap-3 p-2">
                  <span className="flex-1 text-sm font-medium line-clamp-2">
                    {video.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSetCover(video)}
                    aria-label="Use as channel cover"
                    title="Use as channel cover"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRenameVideo(video)}
                    aria-label="Rename video"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveVideo(video)}
                    aria-label="Remove video"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>

      <ImportFromBunnyDialog
        channelId={channel.id}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          loadVideos();
          onChannelChanged();
        }}
      />
    </Dialog>
  );
}

function ImportFromBunnyDialog({
  channelId,
  open,
  onClose,
  onImported,
}: {
  channelId: number;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [videos, setVideos] = useState<BunnyLibraryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSelected(new Set());
    try {
      const res = await fetch(`/api/channels/${channelId}/bunny-library`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVideos(data.videos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // A video can be selected only if it's ready (status 4) and not yet imported.
  const selectable = videos.filter((v) => v.status === 4 && !v.imported);
  const allSelected =
    selectable.length > 0 && selectable.every((v) => selected.has(v.guid));

  function toggle(guid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(guid)) next.delete(guid);
      else next.add(guid);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((v) => v.guid)));
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/videos/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Imported ${data.imported} video(s)`);
      onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Bunny library</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Loading library…
          </p>
        ) : error ? (
          <p className="text-sm text-destructive py-4">{error}</p>
        ) : videos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No videos found in this library.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleAll}
              disabled={selectable.length === 0}
              className="text-sm text-left text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              {allSelected ? "Deselect all" : `Select all (${selectable.length})`}
            </button>

            <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
              {videos.map((v) => {
                const isSelectable = v.status === 4 && !v.imported;
                return (
                  <label
                    key={v.guid}
                    className={`flex items-center gap-3 rounded-md border p-2 ${
                      isSelectable
                        ? "cursor-pointer hover:bg-accent"
                        : "opacity-60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-primary"
                      checked={selected.has(v.guid)}
                      disabled={!isSelectable}
                      onChange={() => toggle(v.guid)}
                    />
                    <span className="flex-1 text-sm font-medium line-clamp-2">
                      {v.title}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
                      {v.imported
                        ? "Imported"
                        : v.status !== 4
                          ? "Processing…"
                          : formatSeconds(v.lengthSeconds)}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={importing || selected.size === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Importing…
                  </>
                ) : (
                  `Import ${selected.size || ""}`.trim()
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
