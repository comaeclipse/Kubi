"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PinInput } from "@/components/parent/pin-input";
import { useAuth } from "@/context/auth-context";

// Wraps a parent-only screen. Until the parent enters their PIN the children
// are never rendered at all — replaced, not overlaid — so a kid can't read the
// settings underneath a dialog. The matching server-side gate is requireParent().
//
// Three states:
//   no PIN yet  -> create one (existing accounts land here once; new accounts
//                  set theirs during onboarding)
//   locked      -> enter the PIN, or recover with the account password
//   unlocked    -> render the screen until the unlock ticket expires
export function ParentGate({ children }: { children: ReactNode }) {
  const { user, loading, refresh } = useAuth();

  const expiry = user?.pinUnlockedUntil
    ? new Date(user.pinUnlockedUntil).getTime()
    : null;
  // The expiry we've already burned through. The server only ever hands back a
  // future expiry (it validates the ticket before reporting it), so a fresh
  // value means unlocked; the timer below flips it back at the exact moment it
  // lapses, re-locking the screen in place instead of on the next navigation.
  const [lapsed, setLapsed] = useState<number | null>(null);
  const unlocked = expiry !== null && lapsed !== expiry;

  useEffect(() => {
    if (expiry === null) return;
    const timer = setTimeout(
      () => setLapsed(expiry),
      Math.max(0, expiry - Date.now())
    );
    return () => clearTimeout(timer);
  }, [expiry]);

  if (loading && !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // The app shell redirects signed-out visitors; this is a safety net.
  if (!user) return null;

  if (!user.hasPin) return <CreatePinCard onDone={refresh} />;
  if (!unlocked) return <UnlockCard onDone={refresh} />;

  return <>{children}</>;
}

function GateCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-sm py-12">
      <div className="space-y-5 rounded-xl border p-6 text-center">
        <div className="flex justify-center text-muted-foreground">{icon}</div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreatePinCard({ onDone }: { onDone: () => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  const ready = pin.length === 4 && confirmPin.length === 4;

  async function submit() {
    if (!ready || saving) return;
    if (pin !== confirmPin) {
      toast.error("Those PINs don't match");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/parent-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) throw new Error("Failed");
      await onDone();
    } catch {
      toast.error("Couldn't save your PIN. Please try again.");
      setSaving(false);
    }
  }

  return (
    <GateCard
      icon={<ShieldCheck className="h-8 w-8" />}
      title="Create your parent PIN"
      description="A 4-digit PIN keeps kids out of the settings that decide what they can watch. You'll enter it whenever you open a parent screen."
    >
      <div className="space-y-3 text-left">
        <div className="space-y-1.5">
          <label htmlFor="new-pin" className="text-sm font-medium">
            New PIN
          </label>
          <PinInput id="new-pin" value={pin} onChange={setPin} autoFocus />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm-pin" className="text-sm font-medium">
            Confirm PIN
          </label>
          <PinInput
            id="confirm-pin"
            value={confirmPin}
            onChange={setConfirmPin}
            onEnter={submit}
          />
        </div>
      </div>
      <Button onClick={submit} disabled={!ready || saving} className="w-full">
        {saving ? "Saving…" : "Set PIN"}
      </Button>
    </GateCard>
  );
}

function UnlockCard({ onDone }: { onDone: () => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);

  const submit = useCallback(async () => {
    if (pin.length !== 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/parent-pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await onDone();
        return;
      }
      setPin("");
      if (data.error === "too_many_attempts") {
        const until = data.lockedUntil ? new Date(data.lockedUntil) : null;
        const minutes = until
          ? Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000))
          : 5;
        setError(`Too many tries. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
      } else if (data.error === "incorrect_pin") {
        setError(
          `Wrong PIN. ${data.attemptsRemaining} ${
            data.attemptsRemaining === 1 ? "try" : "tries"
          } left before this locks.`
        );
      } else {
        setError("Couldn't check that PIN. Please try again.");
      }
    } catch {
      setError("Couldn't check that PIN. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [pin, busy, onDone]);

  if (recovering) {
    return <ResetPinCard onDone={onDone} onCancel={() => setRecovering(false)} />;
  }

  return (
    <GateCard
      icon={<Lock className="h-8 w-8" />}
      title="Enter your parent PIN"
      description="This screen is for grown-ups."
    >
      <div className="space-y-2">
        <PinInput value={pin} onChange={setPin} onEnter={submit} autoFocus />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="space-y-2">
        <Button
          onClick={submit}
          disabled={pin.length !== 4 || busy}
          className="w-full"
        >
          {busy ? "Checking…" : "Unlock"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setRecovering(true)}
        >
          Forgot your PIN?
        </Button>
      </div>
    </GateCard>
  );
}

// Recovery path: prove ownership with the account password — something the
// parent already knows and a kid doesn't — and set a fresh PIN in one step.
function ResetPinCard({
  onDone,
  onCancel,
}: {
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = password.length > 0 && pin.length === 4 && confirmPin.length === 4;

  async function submit() {
    if (!ready || busy) return;
    if (pin !== confirmPin) {
      setError("Those PINs don't match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/parent-pin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, pin }),
      });
      if (res.ok) {
        toast.success("PIN updated");
        await onDone();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't reset your PIN. Please try again.");
    } catch {
      setError("Couldn't reset your PIN. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GateCard
      icon={<Lock className="h-8 w-8" />}
      title="Reset your parent PIN"
      description="Confirm your account password to choose a new PIN."
    >
      <div className="space-y-3 text-left">
        <div className="space-y-1.5">
          <label htmlFor="reset-password" className="text-sm font-medium">
            Account password
          </label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="reset-pin" className="text-sm font-medium">
            New PIN
          </label>
          <PinInput id="reset-pin" value={pin} onChange={setPin} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="reset-confirm-pin" className="text-sm font-medium">
            Confirm new PIN
          </label>
          <PinInput
            id="reset-confirm-pin"
            value={confirmPin}
            onChange={setConfirmPin}
            onEnter={submit}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="space-y-2">
        <Button onClick={submit} disabled={!ready || busy} className="w-full">
          {busy ? "Saving…" : "Set new PIN"}
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={onCancel}>
          Back
        </Button>
      </div>
    </GateCard>
  );
}
