"use client";

import { useEffect } from "react";

// Last-resort fallback: only fires if the ROOT LAYOUT itself throws (e.g. the
// server-side auth/profile data fetch it renders with). Must render its own
// <html>/<body> since it replaces the entire root layout tree. Kept dependency
// free (no shared components/providers) since those live in the layout that
// just failed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            minHeight: "100vh",
            padding: "1.5rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            Kubi hit an unexpected error
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#666", maxWidth: 320 }}>
            Please try again. If this keeps happening, try logging in again.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                background: "#4f46e5",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = "/login")}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                background: "transparent",
                color: "#333",
                border: "1px solid #ccc",
                cursor: "pointer",
              }}
            >
              Go to login
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
