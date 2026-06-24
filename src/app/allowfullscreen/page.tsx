"use client";

import { useEffect, useRef, useState } from "react";

// Test bench for getting a usable fullscreen button on iOS WITHOUT exposing
// clickable YouTube chrome ("Watch on YouTube", logo, "More videos", etc.).
//
// Two modes you can A/B on a real device:
//
//   "api"     — YouTube IFrame API with native controls (controls:1, fs:1).
//               Has YouTube's own ⛶ button, but ALSO its clickable links.
//
//   "sandbox" — plain <iframe> sandboxed WITHOUT allow-popups / top-navigation.
//               The "Watch on YouTube" (target=_blank) + "Copy link" controls
//               can no longer navigate, so they become dead clicks. The buttons
//               are still visible (we cannot hide elements inside a cross-origin
//               iframe), but they stop yanking you to youtube.com.
//
// Why overlays don't work: that chrome lives inside a cross-origin iframe (can't
// position over just those elements), and in TRUE iOS fullscreen the native
// video player owns the whole screen — your DOM isn't drawn on top of it.
//
// The only fully clean path is self-hosting (see BunnyVideoPlayer): a
// same-origin <video> gives webkitEnterFullscreen() with zero YouTube chrome.

const DEMO_VIDEO = {
  youtubeVideoId: "lz_lz2qDla0",
  title: "PBS KIDS Talk About: Life Changes | PBS KIDS",
  channelTitle: "PBS KIDS",
  channelUrl: "https://www.youtube.com/channel/UCrNnk0wFBnCS1awGjq_ijGQ",
};

type FullscreenIframe = HTMLIFrameElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type Mode = "sandbox" | "api";

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as "MacIntel" but is a touch device.
  const iPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function requestIframeFullscreen(
  iframe: FullscreenIframe | null,
  setStatus: (s: string) => void
) {
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
      "iframe.requestFullscreen is undefined — no element Fullscreen API (expected on iOS). Use YouTube's ⛶ button inside the player."
    );
  }
}

function ApiPlayer({
  isIOS,
  status,
  setStatus,
}: {
  isIOS: boolean;
  status: string;
  setStatus: (s: string) => void;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const [iframeReady, setIframeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function createPlayer() {
      if (cancelled || !targetRef.current || playerRef.current) return;
      playerRef.current = new window.YT.Player(targetRef.current, {
        videoId: DEMO_VIDEO.youtubeVideoId,
        playerVars: {
          controls: 1,
          fs: 1,
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
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

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <div ref={targetRef} className="h-full w-full" />
      </div>
      <button
        onClick={() =>
          requestIframeFullscreen(
            (playerRef.current?.getIframe() as FullscreenIframe) ?? null,
            setStatus
          )
        }
        disabled={!iframeReady}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Request fullscreen via JS (iframe.requestFullscreen)
      </button>
      <p className="text-xs text-muted-foreground">
        {isIOS
          ? "iOS: use YouTube's ⛶ button. Note its links here are LIVE and will open youtube.com."
          : "Desktop/Android: both the ⛶ button and the JS button give real fullscreen."}
      </p>
      {status && (
        <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs">
          {status}
        </p>
      )}
    </div>
  );
}

function SandboxPlayer({
  status,
  setStatus,
}: {
  status: string;
  setStatus: (s: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          ref={iframeRef}
          src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO.youtubeVideoId}?rel=0&playsinline=1&enablejsapi=1`}
          title={DEMO_VIDEO.title}
          className="absolute inset-0 h-full w-full border-0"
          // Deliberately NO allow-popups / allow-top-navigation: that disables
          // the "Watch on YouTube" + "Copy link" navigation.
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
      <button
        onClick={() =>
          requestIframeFullscreen(
            (iframeRef.current as FullscreenIframe) ?? null,
            setStatus
          )
        }
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Request fullscreen via JS (iframe.requestFullscreen)
      </button>
      <p className="text-xs text-muted-foreground">
        Tap the YouTube links in the player — they should be DEAD (no new tab).
        If the video shows an error instead of playing, the sandbox is too strict
        for the embed on this browser.
      </p>
      {status && (
        <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs">
          {status}
        </p>
      )}
    </div>
  );
}

export default function AllowFullscreenDemoPage() {
  const [isIOS, setIsIOS] = useState(false);
  const [mode, setMode] = useState<Mode>("sandbox");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setIsIOS(detectIOS());
  }, []);

  function switchMode(next: Mode) {
    setStatus("");
    setMode(next);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Fullscreen-without-chrome test</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detected platform:{" "}
          <span className="font-semibold">
            {isIOS ? "iOS (iPhone/iPad)" : "non-iOS"}
          </span>
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => switchMode("sandbox")}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            mode === "sandbox"
              ? "bg-foreground text-background"
              : "bg-background"
          }`}
        >
          Sandboxed iframe (kills links)
        </button>
        <button
          onClick={() => switchMode("api")}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            mode === "api" ? "bg-foreground text-background" : "bg-background"
          }`}
        >
          API + native controls (links live)
        </button>
      </div>

      {/* Remount per mode so the iframe/player is recreated cleanly. */}
      {mode === "sandbox" ? (
        <SandboxPlayer key="sandbox" status={status} setStatus={setStatus} />
      ) : (
        <ApiPlayer
          key="api"
          isIOS={isIOS}
          status={status}
          setStatus={setStatus}
        />
      )}

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
        <p className="font-semibold text-foreground">Notes</p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>
            Sandbox can neuter link navigation but cannot HIDE YouTube&apos;s
            buttons (they live inside a cross-origin iframe).
          </li>
          <li>
            Overlay divs can&apos;t cover them either — cross-origin position is
            unknown, and native iOS fullscreen draws over your whole page.
          </li>
          <li>
            For a truly clean fullscreen button (no YouTube chrome at all),
            self-host the video (Bunny) and use a same-origin &lt;video&gt;.
          </li>
          <li>
            Disabling/obscuring embed chrome may conflict with YouTube&apos;s
            embed Terms of Service — worth checking before shipping.
          </li>
        </ul>
      </div>
    </div>
  );
}
