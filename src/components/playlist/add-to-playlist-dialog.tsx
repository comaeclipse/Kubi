"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ListPlus, Check, Plus } from "lucide-react";
import { useProfile } from "@/context/profile-context";

interface Playlist {
  id: number;
  name: string;
  profileId: number | null;
  videoCount: number;
  containsVideo: boolean;
}

interface AddToPlaylistDialogProps {
  videoId: number;
  videoTitle: string;
}

export function AddToPlaylistDialog({
  videoId,
  videoTitle,
}: AddToPlaylistDialogProps) {
  const { activeProfile } = useProfile();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const profileParam = activeProfile ? `profileId=${activeProfile.id}&` : "";
    fetch(`/api/playlists?${profileParam}videoId=${videoId}`)
      .then((r) => r.json())
      .then((data) => setPlaylists(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, videoId, activeProfile]);

  async function toggleVideo(playlist: Playlist) {
    const wasIn = playlist.containsVideo;
    const method = wasIn ? "DELETE" : "POST";

    try {
      const res = await fetch(`/api/playlists/${playlist.id}/videos`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, profileId: activeProfile?.id }),
      });
      if (!res.ok) throw new Error();

      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlist.id
            ? {
                ...p,
                containsVideo: !wasIn,
                videoCount: wasIn ? p.videoCount - 1 : p.videoCount + 1,
              }
            : p
        )
      );
      toast.success(wasIn ? `Removed from ${playlist.name}` : `Added to ${playlist.name}`);
    } catch {
      toast.error("Failed to update playlist");
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          profileId: activeProfile?.id ?? null,
        }),
      });
      if (!res.ok) throw new Error();
      const playlist = await res.json();

      // Add video to the new playlist
      await fetch(`/api/playlists/${playlist.id}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, profileId: activeProfile?.id }),
      });

      setPlaylists((prev) => [
        ...prev,
        { ...playlist, videoCount: 1, containsVideo: true },
      ]);
      setNewName("");
      toast.success(`Created "${playlist.name}" and added video`);
    } catch {
      toast.error("Failed to create playlist");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ListPlus className="h-4 w-4 mr-1.5" />
          Add to Playlist
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Playlist</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground truncate">{videoTitle}</p>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Loading...</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {playlists.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                No playlists yet. Create one below.
              </p>
            )}
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => toggleVideo(playlist)}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-left hover:bg-muted transition-colors"
              >
                <div
                  className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                    playlist.containsVideo
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {playlist.containsVideo && <Check className="h-3 w-3" />}
                </div>
                <span className="flex-1 truncate">{playlist.name}</span>
                <span className="text-xs text-muted-foreground">
                  {playlist.videoCount} video{playlist.videoCount !== 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Input
            placeholder="New playlist name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            maxLength={50}
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
