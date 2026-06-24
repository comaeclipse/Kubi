"use client";

import { useEffect, useRef, useState } from "react";

// Static demo of the "native YouTube fullscreen" path for iOS.
//
// Unlike the real player (custom controls, controls:0, iframe wrapped in
// pointer-events-none), this demo intentionally:
//   1. shows YouTube's NATIVE controls (controls:1, fs:1) so YouTube's own ⛶
//      fullscreen button is available, and
//   2. tags the generated iframe with allowfullscreen + allow="fullscreen".
//
// On iOS, true OS-level fullscreen is only reachable when YouTube itself calls
// webkitEnterFullscreen() on its internal <video> — which only happens when the
// user taps YouTube's own ⛶ button. Our page cannot trigger it from outside a
// cross-origin iframe. The "Request fullscreen via JS" button below uses the
// standard Fullscreen API on the iframe element, which works on desktop/Android
// but is a no-op on iOS (no element fullscreen) — included so you can feel the
// difference per browser.

const DEMO_VIDEO = {
  youtubeVideoId: "lz_lz2qDla0",
  title: "PBS KIDS Talk About: Life Changes | PBS KIDS",
  channelTitle: "PBS KIDS",
  channelUrl: "https://www.youtube.com/channel/UCrNnk0wFBnCS1awGjq_ijGQ",
};

type FullscreenIframe = HTMLIFrameElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as "MacIntel" but is a touch device.
  const iPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

export default function AllowFullscreenDemoPage() {
  const targetRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    setIsIOS(detectIOS());
  }, []);

  useEffect(() => {
    let cancelled = false;

    function createPlayer() {
      if (cancelled || !targetRef.current || playerRef.current) return;
      playerRef.current = new window.YT.Player(targetRef.current, {
        videoId: DEMO_VIDEO.youtubeVideoId,
        playerVars: {
          // Native controls ON so YouTube's own fullscreen button is present.
          controls: 1,
          fs: 1,
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            // The API replaces our target <div> with the iframe, so reach it
            // via getIframe() rather than querying the (now-detached) div.
            const iframe = playerRef.current?.getIframe();
            if (iframe) {
              iframe.setAttribute("allowfullscreen", "");
              iframe.setAttribute(
                "allow",
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              );
            }
            setIframeReady(true);
          },
        },
      });
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      if (!document.getElementById("youtube-iframe-api")) {
        const script = document.createElement("script");
        script.id = "youtube-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        createPlayer();
      };
    }

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  function requestFullscreenViaJs() {
    const iframe = playerRef.current?.getIframe() as FullscreenIframe | null;
    if (!iframe) {
      setStatus("No iframe found yet.");
      return;
    }
    if (typeof iframe.requestFullscreen === "function") {
      iframe
        .requestFullscreen()
        .then(() => setStatus("requestFullscreen() resolved ✓"))
        .catch((e) => setStatus(`requestFullscreen() rejected: ${e.name}`));
    } else if (typeof iframe.webkitRequestFullscreen === "function") {
      iframe.webkitRequestFullscreen();
      setStatus("Called webkitRequestFullscreen() (no promise).");
    } else {
      setStatus(
        "iframe.requestFullscreen is undefined — this browser has no element Fullscreen API (expected on iOS). Use YouTube's ⛶ button instead."
      );
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Native fullscreen demo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          YouTube native controls + <code>allowfullscreen</code> on the iframe.
          On iOS, tap YouTube&apos;s own{" "}
          <span className="font-semibold">⛶</span> button (bottom-right of the
          video) for true OS fullscreen.
        </p>
      </div>

      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <p>
          Detected platform:{" "}
          <span className="font-semibold">
            {isIOS ? "iOS (iPhone/iPad)" : "non-iOS"}
          </span>
        </p>
        <p className="mt-1 text-muted-foreground">
          {isIOS
            ? "Use YouTube's ⛶ control. The JS button below will report that element fullscreen is unavailable."
            : "Both YouTube's ⛶ control and the JS button below should give real fullscreen."}
        </p>
      </div>

      {/* Plain iframe wrapper — NOT pointer-events-none, so YouTube's native
          controls (including its fullscreen button) are tappable. */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <div ref={targetRef} className="h-full w-full" />
      </div>

      <div className="space-y-3">
        <button
          onClick={requestFullscreenViaJs}
          disabled={!iframeReady}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Request fullscreen via JS (iframe.requestFullscreen)
        </button>
        {status && (
          <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs">
            {status}
          </p>
        )}
      </div>

      <div className="border-t pt-4 text-sm">
        <p className="font-semibold">{DEMO_VIDEO.title}</p>
        <a
          href={DEMO_VIDEO.channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:underline"
        >
          {DEMO_VIDEO.channelTitle}
        </a>
      </div>

      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">What to look for</p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>
            <span className="font-medium">Safari/Brave/Firefox iOS:</span>{" "}
            YouTube&apos;s ⛶ button should give true fullscreen (chrome gone,
            rotation). The JS button will say element fullscreen is unavailable.
          </li>
          <li>
            <span className="font-medium">Desktop/Android:</span> both paths
            give real fullscreen.
          </li>
          <li>
            Trade-off vs. the real player: this shows YouTube&apos;s native
            controls and branding, so the custom-controls / non-clickable design
            is lost on this surface.
          </li>
        </ul>
      </div>
    </div>
  );
}
