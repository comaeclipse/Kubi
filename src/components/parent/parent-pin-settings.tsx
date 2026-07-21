"use client";

import { useState } from "react";
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
import { PinInput } from "@/components/parent/pin-input";
import { useAuth } from "@/context/auth-context";

// Parent-PIN controls on the Manage Profiles screen. Reachable only from
// inside the gate, so the parent has already proved the current PIN once —
// we still ask for it here so a PIN left unlocked on a shared tablet can't be
// quietly changed to lock the parent out.
export function ParentPinSettings() {
  const { refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  const ready =
    currentPin.length === 4 && pin.length === 4 && confirmPin.length === 4;

  function reset() {
    setCurrentPin("");
    setPin("");
    setConfirmPin("");
    setError(null);
  }

  async function changePin() {
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
        body: JSON.stringify({ currentPin, pin }),
      });
      if (res.ok) {
        toast.success("PIN updated");
        setOpen(false);
        reset();
        await refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't change your PIN. Please try again.");
    } catch {
      setError("Couldn't change your PIN. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Re-locks the parent screens immediately instead of waiting out the
  // 15-minute unlock — for handing the tablet straight back to a kid.
  async function lockNow() {
    setLocking(true);
    try {
      await fetch("/api/parent-pin/verify", { method: "DELETE" });
      await refresh();
    } catch {
      toast.error("Couldn't lock. Please try again.");
      setLocking(false);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Parent PIN</h2>
      <p className="text-sm text-muted-foreground">
        Your PIN unlocks the parent screens for 15 minutes, then they lock
        again on their own.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Change PIN
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={lockNow}
          disabled={locking}
        >
          {locking ? "Locking…" : "Lock now"}
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change parent PIN</DialogTitle>
            <DialogDescription>
              Enter your current PIN, then pick a new one. Forgot it? Use
              &ldquo;Lock now&rdquo;, then &ldquo;Forgot your PIN?&rdquo; on the
              lock screen to reset it with your account password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="current-pin" className="text-sm font-medium">
                Current PIN
              </label>
              <PinInput
                id="current-pin"
                value={currentPin}
                onChange={setCurrentPin}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="change-pin" className="text-sm font-medium">
                New PIN
              </label>
              <PinInput id="change-pin" value={pin} onChange={setPin} />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="change-confirm-pin"
                className="text-sm font-medium"
              >
                Confirm new PIN
              </label>
              <PinInput
                id="change-confirm-pin"
                value={confirmPin}
                onChange={setConfirmPin}
                onEnter={changePin}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button onClick={changePin} disabled={!ready || busy} className="w-full">
              {busy ? "Saving…" : "Save new PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
