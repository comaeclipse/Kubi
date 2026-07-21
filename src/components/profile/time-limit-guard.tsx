"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hourglass } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { useProfile } from "@/context/profile-context";
import {
  HEARTBEAT_SECONDS,
  WARNING_SECONDS,
  type UsageSnapshot,
} from "@/lib/time-limit";

// Parent-facing routes. The whole point of the time's-up screen is that a kid
// can't watch past it, but a parent must always be able to reach the controls
// to grant more time — so the guard stands down here and the modal offers a
// link into /profiles.
const UNGUARDED_PREFIXES = ["/profiles", "/admin"];

export function TimeLimitGuard() {
  const { activeProfile, clearProfile } = useProfile();
  const pathname = usePathname();
  // Tagged with the profile it describes: switching to a sibling must not show
  // them the previous child's expired tally while the first heartbeat is still
  // in flight.
  const [usage, setUsage] = useState<{
    profileId: number;
    snapshot: UsageSnapshot;
  } | null>(null);

  const profileId = activeProfile?.id ?? null;
  const hasLimit = activeProfile?.dailyLimitMinutes != null;
  const unguarded = UNGUARDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const active = profileId !== null && hasLimit && !unguarded;

  // One warning per profile per day — keyed so a rollover past midnight, or a
  // switch to a sibling, earns its own heads-up.
  const warnedFor = useRef<string | null>(null);

  const announce = useCallback(
    (next: UsageSnapshot, name: string) => {
      if (next.remainingSeconds === null || next.expired) return;
      if (next.remainingSeconds > WARNING_SECONDS) return;
      const key = `${profileId}:${next.usageDate}`;
      if (warnedFor.current === key) return;
      warnedFor.current = key;
      const minutes = Math.max(1, Math.ceil(next.remainingSeconds / 60));
      toast(`${minutes} more minute${minutes === 1 ? "" : "s"}, ${name}!`, {
        description: "Time to start wrapping up.",
      });
    },
    [profileId]
  );

  useEffect(() => {
    if (!active || profileId === null) return;

    const name = activeProfile?.name ?? "";
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    // `resume` restarts the server-side clock without banking anything, so the
    // stretch where the tab was closed or hidden isn't charged to the child.
    async function beat(resume: boolean) {
      try {
        const res = await fetch(`/api/profiles/${profileId}/usage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeZone, resume }),
        });
        if (!res.ok || cancelled) return;
        const next: UsageSnapshot = await res.json();
        if (cancelled || profileId === null) return;
        setUsage({ profileId, snapshot: next });
        announce(next, name);
      } catch {
        // A dropped heartbeat just means this interval goes unbanked; the next
        // one picks the tally back up.
      }
    }

    function start() {
      if (timer) return;
      beat(true);
      timer = setInterval(() => beat(false), HEARTBEAT_SECONDS * 1000);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active, profileId, activeProfile?.name, announce]);

  const expired =
    active && usage?.profileId === profileId && usage.snapshot.expired;

  return (
    <Dialog open={expired} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Hourglass className="h-8 w-8 text-muted-foreground" />
          </div>
          <DialogTitle className="text-2xl font-bold">
            Oops! Time&apos;s up!
          </DialogTitle>
          <DialogDescription>
            That&apos;s all the watching for today. See you tomorrow!
          </DialogDescription>
        </DialogHeader>

        {activeProfile && (
          <div className="flex flex-col items-center gap-2 py-2">
            <ProfileAvatar
              name={activeProfile.name}
              avatarColor={activeProfile.avatarColor}
              size="lg"
            />
            <span className="text-sm font-medium">{activeProfile.name}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button onClick={clearProfile} className="w-full">
            Switch profile
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/profiles">Parent settings</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
