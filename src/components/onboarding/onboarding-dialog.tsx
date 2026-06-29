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
import { Input } from "@/components/ui/input";
import { ChannelAvatar } from "@/components/channel/channel-avatar";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { PROFILE_COLORS } from "@/lib/profile-colors";
import { useAuth } from "@/context/auth-context";
import { useProfile } from "@/context/profile-context";
import { toast } from "sonner";

interface Channel {
  id: number;
  title: string;
  thumbnailUrl: string | null;
}

// First-run wizard. Step 1 sets up the parent's first kid profile (required);
// step 2 shows the master channel library as a grid of greyed-out icons that
// light up as the parent picks them. Renders only for signed-in accounts that
// haven't onboarded yet. Channels are account-wide, so the profile step is
// purely about getting at least one "who's watching" profile in place first.
export function OnboardingDialog() {
  const { user, loading, refresh } = useAuth();
  const { switchProfile, refreshProfiles } = useProfile();

  const [step, setStep] = useState<"profile" | "channels">("profile");

  // Profile step
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROFILE_COLORS[0].value);
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Channels step
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

  const createProfile = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreatingProfile(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, avatarColor: color }),
      });
      if (!res.ok) throw new Error("Failed");
      const profile: { id: number } = await res.json();
      await refreshProfiles();
      // Mark it active so the "Who's watching?" picker doesn't immediately nag
      // for the single profile we just created.
      switchProfile(profile.id);
      setStep("channels");
    } catch {
      toast.error("Couldn't create the profile. Please try again.");
    } finally {
      setCreatingProfile(false);
    }
  }, [name, color, refreshProfiles, switchProfile]);

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

  if (step === "profile") {
    return (
      <Dialog open onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Create your first profile</DialogTitle>
            <DialogDescription>
              Profiles let each kid track their own watch progress. Add one to
              get started — you can add more anytime in Manage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex justify-center">
              <ProfileAvatar
                name={name || "?"}
                avatarColor={color}
                size="xl"
              />
            </div>
            <Input
              placeholder="Profile name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim() && !creatingProfile) {
                  createProfile();
                }
              }}
            />
            <div>
              <p className="text-sm font-medium mb-2">Pick a color</p>
              <div className="flex flex-wrap gap-2">
                {PROFILE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`h-8 w-8 rounded-full transition-all ${
                      color === c.value
                        ? "ring-2 ring-offset-2 ring-foreground scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={createProfile}
              disabled={creatingProfile || !name.trim()}
              className="w-full"
            >
              {creatingProfile ? "Creating…" : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Channels step. If the library is empty there's nothing to pick, so finish
  // onboarding straight away rather than showing an empty grid.
  if (channels !== null && channels.length === 0) {
    return null;
  }

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
            Select channels from the list below, or skip and add others manually
            later in Manage.
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
          {(channels ?? []).map((ch) => {
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
