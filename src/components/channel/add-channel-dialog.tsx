"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2 } from "lucide-react";

interface AddChannelDialogProps {
  onAdded: () => void;
}

export function AddChannelDialog({ onAdded }: AddChannelDialogProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError("");

    try {
      // Step 1: Create the channel record (returns immediately)
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add channel");
      }

      const { channel } = await res.json();

      // Step 2: Paginated import loop — one page of 50 videos per call
      setLoading(false);
      setImporting(true);
      setImportedCount(0);

      let pageToken: string | null = null;
      let total = 0;

      do {
        const importRes: Response = await fetch(
          `/api/channels/${channel.id}/import`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageToken }),
          }
        );

        if (!importRes.ok) {
          const errData = await importRes.json();
          throw new Error(errData.error || "Import failed");
        }

        const data: { imported: number; nextPageToken: string | null } =
          await importRes.json();
        total += data.imported;
        setImportedCount(total);
        pageToken = data.nextPageToken ?? null;
      } while (pageToken);

      // Done — notify parent and close
      setInput("");
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add channel");
    } finally {
      setLoading(false);
      setImporting(false);
      setImportedCount(0);
    }
  }

  function handleOpenChange(next: boolean) {
    // Prevent closing while import is in progress
    if (importing) return;
    setOpen(next);
    if (!next) {
      setInput("");
      setError("");
    }
  }

  const isBusy = loading || importing;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Add Channel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add YouTube Channel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="YouTube channel URL, @handle, or channel ID"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isBusy}
          />

          {importing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>
                Importing videos… {importedCount > 0 ? `${importedCount} imported so far` : "starting…"}
              </span>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy || !input.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Adding…
                </>
              ) : importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Importing…
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
