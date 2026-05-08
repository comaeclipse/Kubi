"use client";

import { useState } from "react";
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
import { Plus, Pencil, Trash2, ListMusic, Download } from "lucide-react";

interface Playlist {
  id: number;
  name: string;
  profileId: number | null;
  videoCount: number;
}

interface PlaylistManagerProps {
  playlists: Playlist[];
  onRefresh: () => Promise<void>;
}

export function PlaylistManager({ playlists, onRefresh }: PlaylistManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importName, setImportName] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);

  function openCreateDialog() {
    setEditingPlaylist(null);
    setName("");
    setDialogOpen(true);
  }

  function openEditDialog(playlist: Playlist) {
    setEditingPlaylist(playlist);
    setName(playlist.name);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    try {
      if (editingPlaylist) {
        const res = await fetch(`/api/playlists/${editingPlaylist.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (!res.ok) throw new Error("Failed to update playlist");
        toast.success("Playlist updated");
      } else {
        const res = await fetch("/api/playlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), profileId: null }),
        });
        if (!res.ok) throw new Error("Failed to create playlist");
        toast.success("Playlist created");
      }
      setDialogOpen(false);
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const res = await fetch("/api/playlists/import-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: importName, url: importUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      if (data.matched > 0) {
        toast.success(`Imported ${data.matched} of ${data.total} videos into "${data.name}"`);
      } else {
        toast.warning(`Playlist created, but none of the ${data.total} videos are in the library yet`);
      }
      setImportDialogOpen(false);
      setImportName("");
      setImportUrl("");
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/playlists/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete playlist");
      toast.success("Playlist deleted");
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Shared Playlists</h2>
        <div className="flex items-center gap-2">
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1.5" />
                Import from YouTube
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import YouTube Playlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Input
                  placeholder="Playlist name"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  maxLength={50}
                  autoFocus
                />
                <Input
                  placeholder="YouTube playlist URL"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                />
                <Button
                  onClick={handleImport}
                  disabled={importing || !importName.trim() || !importUrl.trim()}
                  className="w-full"
                >
                  {importing ? "Importing…" : "Import Playlist"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Playlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingPlaylist ? "Edit Playlist" : "Create Shared Playlist"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Input
                  placeholder="Playlist name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  maxLength={50}
                  autoFocus
                />
                <Button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="w-full"
                >
                  {saving
                    ? "Saving..."
                    : editingPlaylist
                      ? "Save Changes"
                      : "Create Playlist"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {playlists.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No shared playlists yet. Create one to curate videos for all profiles.
        </p>
      ) : (
        <div className="space-y-2">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <ListMusic className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{playlist.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {playlist.videoCount} video{playlist.videoCount !== 1 ? "s" : ""}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(playlist)}
                title="Edit playlist"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(playlist.id)}
                title="Delete playlist"
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
