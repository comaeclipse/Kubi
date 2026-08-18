"use client";

import { useEffect, useRef, useState, useCallback } from "react";

import { useFullscreen } from "@/hooks/use-fullscreen";

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
  }
}

interface VideoPlayerProps {
  youtubeVideoId: string;
  // The /watch/[slug] route id (scrambled publicId). Progress is saved against
  // this so the real youtube id never appears in app request URLs.
  progressSlug: string;
  title: string;
  startSeconds?: number;
  profileId?: number;
  // Embed via youtube-nocookie.com (privacy-enhanced mode) instead of
  // youtube.com. Defaults to true so the cookie-setting host is never used
  // sitewide; the nocookie host speaks the identical IFrame API, so controls,
  // progress saving, and events are unaffected. Pass false only to opt out.
  useNoCookieHost?: boolean;
}

const SAVE_INTERVAL_MS = 10_000;
const NEAR_END_THRESHOLD_SECONDS = 10;
const PROGRESS_TICK_MS = 250;
const CONTROLS_HIDE_MS = 2500;
const CONTROLS_LEAVE_MS = 800;
const TOUCH_CONTROLS_HIDE_MS = 4000;

const VOLUME_COOKIE_NAME = "kubi_video_volume";
const VOLUME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function getStoredVolume(): number | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${VOLUME_COOKIE_NAME}=(\\d+)`)
  );
  if (!match) return null;
  const val = Number(match[1]);
  return Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : null;
}

function setStoredVolume(val: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${VOLUME_COOKIE_NAME}=${val}; path=/; max-age=${VOLUME_COOKIE_MAX_AGE}`;
}

export function VideoPlayer({
  youtubeVideoId,
  progressSlug,
  title,
  startSeconds = 0,
  profileId,
  useNoCookieHost = true,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeTargetRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchRevealedControlsRef = useRef(false);
  const showControlsRef = useRef(true);
  const isScrubbingRef = useRef(false);
  const startSecondsRef = useRef(startSeconds);
  const profileIdRef = useRef(profileId);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(() => getStoredVolume() ?? 100);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);

  useEffect(() => {
    profileIdRef.current = profileId;
  }, [profileId]);

  useEffect(() => {
    startSecondsRef.current = startSeconds;
  }, [startSeconds]);

  // --- Progress saving (existing SafeVision logic) ---

  const saveProgress = useCallback(
    async (seconds: number) => {
      if (!profileIdRef.current) return;
      try {
        await fetch(`/api/videos/${progressSlug}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seconds,
            profileId: profileIdRef.current,
          }),
        });
      } catch {
        // Silently ignore network errors during progress saves
      }
    },
    [progressSlug]
  );

  function startSaveInterval(player: YT.Player) {
    if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    saveIntervalRef.current = setInterval(() => {
      const current = player.getCurrentTime();
      const dur = player.getDuration();
      if (dur > 0 && current >= dur - NEAR_END_THRESHOLD_SECONDS) {
        saveProgress(0);
      } else {
        saveProgress(current);
      }
    }, SAVE_INTERVAL_MS);
  }

  function stopSaveInterval() {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
  }

  // --- UI progress tracking (from videotesting) ---

  const startProgressTracking = useCallback(() => {
    if (uiIntervalRef.current) clearInterval(uiIntervalRef.current);
    uiIntervalRef.current = setInterval(() => {
      // While the user drags the seek bar, their position wins over the player's
      if (isScrubbingRef.current) return;
      if (playerRef.current?.getCurrentTime && playerRef.current?.getDuration) {
        const time = playerRef.current.getCurrentTime();
        const dur = playerRef.current.getDuration();
        setCurrentTime(time);
        setDuration(dur);
        setProgress(dur > 0 ? (time / dur) * 100 : 0);
      }
    }, PROGRESS_TICK_MS);
  }, []);

  const stopProgressTracking = useCallback(() => {
    if (uiIntervalRef.current) {
      clearInterval(uiIntervalRef.current);
      uiIntervalRef.current = null;
    }
  }, []);

  // --- Player creation ---

  function createPlayer() {
    if (!iframeTargetRef.current) return;

    playerRef.current = new window.YT.Player(iframeTargetRef.current, {
      ...(useNoCookieHost
        ? { host: "https://www.youtube-nocookie.com" }
        : {}),
      videoId: youtubeVideoId,
      playerVars: {
        start: Math.floor(startSecondsRef.current),
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        fs: 0,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          setIsReady(true);
          setDuration(playerRef.current?.getDuration() ?? 0);
          const storedVolume = getStoredVolume();
          if (storedVolume !== null) {
            playerRef.current?.setVolume(storedVolume);
          }
        },
        onStateChange: (event: YT.OnStateChangeEvent) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            setIsEnded(false);
            startProgressTracking();
            startSaveInterval(playerRef.current!);
          } else if (event.data === window.YT.PlayerState.ENDED) {
            setIsPlaying(false);
            setIsEnded(true);
            stopProgressTracking();
            stopSaveInterval();
            saveProgress(0);
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
            stopProgressTracking();
            stopSaveInterval();
            const current = playerRef.current!.getCurrentTime();
            const dur = playerRef.current!.getDuration();
            if (dur > 0 && current >= dur - NEAR_END_THRESHOLD_SECONDS) {
              saveProgress(0);
            } else {
              saveProgress(current);
            }
          }
        },
      },
    });
  }

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      createPlayer();
      return;
    }

    if (!document.getElementById("youtube-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousReady) previousReady();
      createPlayer();
    };

    return () => {
      stopProgressTracking();
      stopSaveInterval();
      if (playerRef.current) {
        try {
          const current = playerRef.current.getCurrentTime();
          const dur = playerRef.current.getDuration();
          if (dur > 0 && current >= dur - NEAR_END_THRESHOLD_SECONDS) {
            saveProgress(0);
          } else if (current > 0) {
            saveProgress(current);
          }
          playerRef.current.destroy();
        } catch {
          // Player may already be gone
        }
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeVideoId, useNoCookieHost]);

  // --- Custom controls ---

  const restart = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(0, true);
    playerRef.current.playVideo();
    setIsEnded(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (isEnded) {
      restart();
    } else if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [isPlaying, isEnded, restart]);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  }, [isMuted]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      setVolume(val);
      setStoredVolume(val);
      playerRef.current?.setVolume(val);
      if (val === 0) {
        playerRef.current?.mute();
        setIsMuted(true);
      } else if (isMuted) {
        playerRef.current?.unMute();
        setIsMuted(false);
      }
    },
    [isMuted]
  );

  // Seek by clicking anywhere on the bar, or by dragging the scrubber. During a
  // drag we seek with allowSeekAhead=false so YouTube only shows preview frames;
  // the final seek on release is the one that actually buffers.
  const seekToClientX = useCallback(
    (clientX: number, allowSeekAhead: boolean) => {
      if (!progressRef.current || !playerRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const seconds = pct * duration;
      playerRef.current.seekTo(seconds, allowSeekAhead);
      setProgress(pct * 100);
      setCurrentTime(seconds);
    },
    [duration]
  );

  const handleProgressPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      isScrubbingRef.current = true;
      setIsScrubbing(true);
      seekToClientX(e.clientX, false);
    },
    [seekToClientX]
  );

  const handleProgressPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isScrubbingRef.current) return;
      e.preventDefault();
      seekToClientX(e.clientX, false);
    },
    [seekToClientX]
  );

  const handleProgressPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isScrubbingRef.current) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      seekToClientX(e.clientX, true);
    },
    [seekToClientX]
  );

  useEffect(() => {
    showControlsRef.current = showControls;
  }, [showControls]);

  const handleTouchStart = useCallback(() => {
    if (!showControlsRef.current) {
      // First tap — just reveal controls, flag it so the click doesn't also toggle play
      touchRevealedControlsRef.current = true;
    }
    setShowControls(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      if (isScrubbingRef.current) return;
      touchRevealedControlsRef.current = false;
      setShowControls(false);
    }, TOUCH_CONTROLS_HIDE_MS);
  }, []);

  const handlePlayOverlayClick = useCallback(() => {
    if (touchRevealedControlsRef.current) {
      // This tap was just revealing the controls — don't toggle play
      touchRevealedControlsRef.current = false;
      return;
    }
    togglePlay();
  }, [togglePlay]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, CONTROLS_HIDE_MS);
  }, [isPlaying]);

  const handleMouseLeave = useCallback(() => {
    if (isPlaying) {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      hideTimeout.current = setTimeout(
        () => setShowControls(false),
        CONTROLS_LEAVE_MS
      );
    }
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-xl overflow-hidden bg-black select-none group"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
    >
      {/* YouTube iframe */}
      <div className="absolute inset-0 pointer-events-none">
        <div ref={iframeTargetRef} className="w-full h-full" title={title} />
      </div>

      {/* Clickable overlay for play/pause (covers video area above controls) */}
      <div
        className="absolute inset-0 bottom-[48px] z-10 cursor-pointer"
        onClick={handlePlayOverlayClick}
      />

      {/* End screen overlay — covers YouTube recommendations */}
      {isEnded && (
        <div className="absolute inset-0 z-30 bg-black/85 flex flex-col items-center justify-center gap-4">
          <button
            onClick={restart}
            className="w-16 h-16 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            aria-label="Start over"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            </svg>
          </button>
          <span className="text-white/70 text-sm">Start over</span>
        </div>
      )}

      {/* Big center play button when paused */}
      {isReady && !isPlaying && !isEnded && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <button
            className="pointer-events-auto w-[68px] h-[48px] bg-red-600 hover:bg-red-700 rounded-xl flex items-center justify-center transition-colors"
            onClick={togglePlay}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      )}

      {/* Bottom control bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Gradient fade */}
        <div className="h-16 bg-gradient-to-t from-black/90 to-transparent" />

        {/* Progress bar */}
        <div className="bg-black/90 px-3 pb-2">
          {/* Padded hit area so the 3px track is easy to grab with a finger */}
          <div
            className="group/progress cursor-pointer touch-none py-2 -mt-1 mb-0.5"
            onPointerDown={handleProgressPointerDown}
            onPointerMove={handleProgressPointerMove}
            onPointerUp={handleProgressPointerUp}
            onPointerCancel={handleProgressPointerUp}
          >
            <div
              ref={progressRef}
              className={`relative bg-white/30 transition-all ${
                isScrubbing ? "h-[5px]" : "h-[3px] group-hover/progress:h-[5px]"
              }`}
            >
              <div
                className={`absolute top-0 left-0 h-full bg-red-600 ${
                  isScrubbing ? "" : "transition-[width] duration-150"
                }`}
                style={{ width: `${progress}%` }}
              />
              <div
                className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full transition-opacity ${
                  isScrubbing
                    ? "opacity-100"
                    : "opacity-0 group-hover/progress:opacity-100"
                }`}
                style={{ left: `${progress}%`, marginLeft: "-6px" }}
              />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 text-white">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Start over */}
            <button
              onClick={restart}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              aria-label="Start over"
              title="Start over"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              </svg>
            </button>

            {/* Volume */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                onClick={toggleMute}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="white"
                  >
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : volume < 50 ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="white"
                  >
                    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="white"
                  >
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  showVolumeSlider ? "w-20 ml-1" : "w-0 ml-0"
                }`}
              >
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-full h-1 accent-white cursor-pointer"
                />
              </div>
            </div>

            {/* Time display */}
            <span className="text-xs text-white/80 font-mono tabular-nums ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
