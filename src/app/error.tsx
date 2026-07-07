"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Catches errors thrown while rendering a route (the root layout above this
// keeps rendering — sidebar/header stay intact). See also global-error.tsx,
// which is the fallback if the root layout itself throws.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 min-h-[60vh] p-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        This page hit an unexpected error. Try again, or head back home.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Go home
        </Button>
      </div>
    </div>
  );
}
