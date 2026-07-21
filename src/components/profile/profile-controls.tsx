"use client";

import { useEffect, useState } from "react";
import { Hourglass, Plus, ShieldBan, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile, type Profile } from "@/context/profile-context";
import {
  MAX_BLOCKED_KEYWORDS,
  MAX_BLOCKED_KEYWORD_LENGTH,
} from "@/lib/validation";
import { formatMinutes, type UsageSnapshot } from "@/lib/time-limit";

// Round numbers a parent actually reaches for. "No limit" clears the setting.
const LIMIT_PRESETS: { label: string; minutes: number | null }[] = [
  { label: "No limit", minutes: null },
  { label: "30m", minutes: 30 },
  { label: "45m", minutes: 45 },
  { label: "1h", minutes: 60 },
  { label: "1h 30m", minutes: 90 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
];

export function ProfileControls({ profile }: { profile: Profile }) {
  const { refreshProfiles } = useProfile();
  const [keywords, setKeywords] = useState<string[]>(profile.blockedKeywords);
  const [draft, setDraft] = useState("");
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-seed when the parent switches between children without a remount.
  useEffect(() => {
    setKeywords(profile.blockedKeywords);
  }, [profile.id, profile.blockedKeywords]);

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let cancelled = false;
    fetch(
      `/api/profiles/${profile.id}/usage?timeZone=${encodeURIComponent(timeZone)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setUsage(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  async function patch(body: Record<string, unknown>, message: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      await refreshProfiles();
      toast.success(message);
      return true;
    } catch {
      toast.error("Couldn't save that. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addKeyword() {
    const word = draft.trim().toLowerCase();
    if (!word) return;
    if (keywords.includes(word)) {
      setDraft("");
      return;
    }
    if (keywords.length >= MAX_BLOCKED_KEYWORDS) {
      toast.error(`That's the limit of ${MAX_BLOCKED_KEYWORDS} blocked words.`);
      return;
    }
    const next = [...keywords, word];
    setKeywords(next);
    setDraft("");
    if (!(await patch({ blockedKeywords: next }, `Blocked “${word}”`))) {
      setKeywords(keywords);
    }
  }

  async function removeKeyword(word: string) {
    const next = keywords.filter((k) => k !== word);
    setKeywords(next);
    if (!(await patch({ blockedKeywords: next }, `Unblocked “${word}”`))) {
      setKeywords(keywords);
    }
  }

  async function setLimit(minutes: number | null) {
    await patch(
      { dailyLimitMinutes: minutes },
      minutes === null
        ? `${profile.name} has no time limit`
        : `${profile.name} gets ${formatMinutes(minutes)} a day`
    );
  }

  async function resetToday() {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const res = await fetch(
        `/api/profiles/${profile.id}/usage?timeZone=${encodeURIComponent(timeZone)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      setUsage(await res.json());
      toast.success(`${profile.name}'s timer is back to zero`);
    } catch {
      toast.error("Couldn't reset the timer. Please try again.");
    }
  }

  const limit = profile.dailyLimitMinutes;
  const usedMinutes = Math.floor((usage?.secondsUsed ?? 0) / 60);
  const percentUsed =
    limit === null ? 0 : Math.min(100, ((usage?.secondsUsed ?? 0) / (limit * 60)) * 100);

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Hourglass className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Daily time limit</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          How long {profile.name} can use the app each day. When the time runs
          out they see a friendly “time&apos;s up” screen until tomorrow.
        </p>

        <div className="flex flex-wrap gap-2">
          {LIMIT_PRESETS.map((preset) => {
            const selected = limit === preset.minutes;
            return (
              <Button
                key={preset.label}
                variant={selected ? "default" : "outline"}
                size="sm"
                disabled={saving}
                onClick={() => setLimit(preset.minutes)}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>

        {limit !== null && (
          <div className="space-y-2 pt-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {usedMinutes} of {formatMinutes(limit)} used today
              </p>
              <Button variant="ghost" size="sm" onClick={resetToday}>
                Reset today
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <ShieldBan className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Blocked words</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Any video whose title contains one of these words is hidden from{" "}
          {profile.name}, even on channels you&apos;ve approved. Matching ignores
          capitalisation.
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="Add a word to block…"
            value={draft}
            maxLength={MAX_BLOCKED_KEYWORD_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeyword();
              }
            }}
          />
          <Button onClick={addKeyword} disabled={saving || !draft.trim()}>
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Block</span>
          </Button>
        </div>

        {keywords.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing blocked yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-1 pr-1 pl-3 text-sm"
              >
                {word}
                <button
                  type="button"
                  onClick={() => removeKeyword(word)}
                  disabled={saving}
                  aria-label={`Unblock ${word}`}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
