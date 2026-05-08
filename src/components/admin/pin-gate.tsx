"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

interface PinGateProps {
  onAuthenticated: () => void;
  pinSet: boolean;
}

export function PinGate({ onAuthenticated, pinSet }: PinGateProps) {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError("");

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fullPin = pin.join("");
    if (fullPin.length !== 4) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: fullPin }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid PIN");
      }

      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid PIN");
      setPin(["", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle>
            {pinSet ? "Enter Admin PIN" : "Create Admin PIN"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {pinSet
              ? "Enter your 4-digit PIN to access admin settings"
              : "Set a 4-digit PIN to protect admin settings"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-center gap-3">
              {pin.map((digit, i) => (
                <Input
                  key={i}
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-14 h-14 text-center text-2xl font-mono"
                  disabled={loading}
                />
              ))}
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || pin.some((d) => !d)}
            >
              {loading
                ? "Verifying..."
                : pinSet
                  ? "Unlock"
                  : "Set PIN"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
