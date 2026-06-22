"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChannelAvatar } from "@/components/channel/channel-avatar";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

interface Channel {
  id: number;
  title: string;
  thumbnailUrl: string | null;
}

// First-run modal: shows the master channel library as a grid of greyed-out
// icons that light up (full colour + check) as the parent picks them. Renders
// only for signed-in accounts that haven't onboarded yet, and only when there
// are channels to choose from.
export function OnboardingDialog() {
  const { user, loading, refresh } = useAuth();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const needsOnboarding = Boolean(user && !user.onboarded);

  useEffect(() => {
    if (!needsOnboarding) return;
    let cancelled = false;
    fetch("/api/channels?all=1")
      .then((r) => r.json())
      .then((data: Channel[]) => {
        if (!cancelled) setChannels(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setChannels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [needsOnboarding]);

  const toggle = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const enableAll = useCallback(() => {
    setChannels((cur) => {
      if (cur) setSelected(new Set(cur.map((c) => c.id)));
      return cur;
    });
  }, []);

  const clearAll = useCallback(() => setSelected(new Set()), []);

  const complete = useCallback(
    async (channelIds: number[]) => {
      setSaving(true);
      try {
        const res = await fetch("/api/onboarding/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelIds }),
        });
        if (!res.ok) throw new Error("Failed");
        if (channelIds.length > 0) {
          // Hard reload so the (client-fetched) video feed picks up the newly
          // enabled channels. Onboarded flag is now set, so this won't loop.
          window.location.reload();
          return;
        }
        await refresh(); // marks user.onboarded -> unmounts this dialog
      } catch {
        toast.error("Couldn't save your channels. Please try again.");
        setSaving(false);
      }
    },
    [refresh]
  );

  if (loading || !needsOnboarding) return null;
  if (channels === null || channels.length === 0) return null;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Pick channels for your kids</DialogTitle>
          <DialogDescription>
            These are the channels available in Kubi. Tap the ones you want your
            kids to watch — they light up when selected. You can change this
            anytime in Manage.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={selected.size === 0}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={enableAll}
            >
              Enable all
            </Button>
          </div>
        </div>

        <div className="grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto py-1 sm:grid-cols-4">
          {channels.map((ch) => {
            const isSel = selected.has(ch.id);
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => toggle(ch.id)}
                aria-pressed={isSel}
                title={ch.title}
                className={`group relative flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors ${
                  isSel
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="relative">
                  <ChannelAvatar
                    title={ch.title}
                    thumbnailUrl={ch.thumbnailUrl}
                    className={`h-14 w-14 rounded-full text-lg transition-all duration-200 ${
                      isSel
                        ? "grayscale-0"
                        : "grayscale group-hover:grayscale-0"
                    }`}
                  />
                  {isSel && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <span className="line-clamp-2 text-xs font-medium leading-tight">
                  {ch.title}
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => complete([])}
            disabled={saving}
          >
            Skip for now
          </Button>
          <Button
            type="button"
            onClick={() => complete(Array.from(selected))}
            disabled={saving || selected.size === 0}
          >
            {saving
              ? "Saving…"
              : `Enable ${selected.size} channel${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
