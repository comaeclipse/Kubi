"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FEATURES = [
  "Unlimited kid profiles",
  "Curated YouTube channels",
  "Ad-free safe viewing",
  "Progress tracking per child",
  "Playlists and favourites",
  "Self-hosted Bunny video channels",
];

export default function SubscribePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);

  const trialExpired =
    user?.trialEndsAt && new Date(user.trialEndsAt) <= new Date();

  async function handleSubscribe() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start checkout");
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  async function handlePayPal() {
    setPaypalLoading(true);
    try {
      const res = await fetch("/api/paypal/subscribe", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start PayPal checkout");
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setPaypalLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Kubi</h1>
          {trialExpired ? (
            <p className="mt-2 text-muted-foreground">
              Your free trial has ended. Subscribe to continue.
            </p>
          ) : (
            <p className="mt-2 text-muted-foreground">
              Start your 30-day free trial today.
            </p>
          )}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">$2.99</span>
              <span className="text-muted-foreground text-sm">/ month</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {trialExpired ? "Cancel any time." : "30 days free, then $2.99/month. Cancel any time."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubscribe}
              disabled={loading || paypalLoading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : trialExpired ? (
                "Subscribe — $2.99/month"
              ) : (
                "Start free trial"
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              className="w-full bg-[#ffc439] text-[#003087] hover:bg-[#f0b72f]"
              size="lg"
              onClick={handlePayPal}
              disabled={loading || paypalLoading}
            >
              {paypalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Pay with PayPal"
              )}
            </Button>
          </CardContent>
        </Card>

        {user && (
          <p className="text-center text-xs text-muted-foreground">
            Signed in as {user.email} &middot;{" "}
            <button
              className="underline hover:text-foreground"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
            >
              Log out
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
