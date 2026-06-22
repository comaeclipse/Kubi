"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle } from "lucide-react";

export default function SubscribeSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"polling" | "done">("polling");

  useEffect(() => {
    let attempts = 0;
    const max = 15;

    async function poll() {
      attempts++;
      try {
        const res = await fetch("/api/auth/status");
        const data = await res.json();
        if (data.user?.hasAccess && data.user?.subscriptionId) {
          setStatus("done");
          setTimeout(() => router.push("/"), 1500);
          return;
        }
      } catch {
        // ignore, keep polling
      }
      if (attempts < max) {
        setTimeout(poll, 1000);
      } else {
        // Give up and redirect anyway — webhook may just be delayed
        router.push("/");
      }
    }

    poll();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      {status === "polling" ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Activating your subscription…</p>
        </>
      ) : (
        <>
          <CheckCircle className="h-12 w-12 text-green-500" />
          <p className="text-lg font-semibold">You&apos;re all set!</p>
          <p className="text-muted-foreground text-sm">Taking you to Kubi…</p>
        </>
      )}
    </div>
  );
}
