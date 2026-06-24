"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

// Cross-browser fullscreen for our custom video/music players.
//
// iOS Safari (iPhone *and* iPad) does NOT implement the Fullscreen API on
// arbitrary elements — only a native <video> can go fullscreen. Our players
// wrap a cross-origin YouTube iframe we can't reach into, so real fullscreen is
// impossible there. When the native API is unavailable (or rejects), we fall
// back to a CSS "fill the viewport" mode driven by the `data-css-fullscreen`
// attribute (see globals.css). Desktop Safari needs the webkit-prefixed calls.

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function nativeFullscreenAvailable(el: HTMLElement): boolean {
  const doc = document as FullscreenDocument;
  const enabled = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false;
  const element = el as FullscreenElement;
  return (
    enabled &&
    (typeof element.requestFullscreen === "function" ||
      typeof element.webkitRequestFullscreen === "function")
  );
}

function currentNativeFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cssFallbackActive = useRef(false);

  // Sync state with native fullscreen changes (Esc key, OS gestures, etc.).
  useEffect(() => {
    const sync = () => {
      if (cssFallbackActive.current) return;
      setIsFullscreen(!!currentNativeFullscreenElement());
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const enterCssFallback = useCallback((el: HTMLElement) => {
    cssFallbackActive.current = true;
    el.setAttribute("data-css-fullscreen", "true");
    document.body.style.overflow = "hidden";
    setIsFullscreen(true);
  }, []);

  const exitCssFallback = useCallback((el: HTMLElement) => {
    cssFallbackActive.current = false;
    el.removeAttribute("data-css-fullscreen");
    document.body.style.overflow = "";
    setIsFullscreen(false);
  }, []);

  // Clean up the CSS fallback if the component unmounts while "fullscreen".
  useEffect(() => {
    const el = ref.current;
    return () => {
      if (cssFallbackActive.current && el) exitCssFallback(el);
    };
  }, [ref, exitCssFallback]);

  const toggle = useCallback(async () => {
    const el = ref.current as FullscreenElement | null;
    if (!el) return;
    const doc = document as FullscreenDocument;

    // Currently faking fullscreen via CSS → undo it.
    if (cssFallbackActive.current) {
      exitCssFallback(el);
      return;
    }

    // Currently in real fullscreen → exit it.
    if (currentNativeFullscreenElement()) {
      if (typeof doc.exitFullscreen === "function") await doc.exitFullscreen();
      else if (typeof doc.webkitExitFullscreen === "function") {
        doc.webkitExitFullscreen();
      }
      return;
    }

    // Enter — prefer the real API, fall back to CSS on iOS.
    if (nativeFullscreenAvailable(el)) {
      try {
        if (typeof el.requestFullscreen === "function") {
          await el.requestFullscreen();
        } else if (typeof el.webkitRequestFullscreen === "function") {
          await el.webkitRequestFullscreen();
        }
        return;
      } catch {
        // e.g. NotAllowedError — drop through to the CSS fallback.
      }
    }
    enterCssFallback(el);
  }, [ref, enterCssFallback, exitCssFallback]);

  return { isFullscreen, toggle };
}
