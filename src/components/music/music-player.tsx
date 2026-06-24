"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Maximize,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFullscreen } from "@/hooks/use-fullscreen";

export interface MusicQueueItem {
  id: number;
  youtubeVideoId: string;
  title: string;
  duration: string | null;
  thumbnailUrl: string | null;
  channelId: number;
  youtubeChannelId: string;
  channelTitle: string;
  channelThumbnailUrl: string | null;
}

interface MusicPlayerProps {
  track: MusicQueueItem;
  hasPrevious: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onEnded: () => void;
  onError: () => void;
}

const PROGRESS_INTERVAL_MS = 250;

export function MusicPlayer({
  track,
  hasPrevious,
  onPrevious,
  onNext,
  onEnded,
  onError,
}: MusicPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackIdRef = useRef(track.youtubeVideoId);
  const startedRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);

  const { toggle: toggleFullscreen } = useFullscreen(containerRef);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const stopProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    stopProgress();
    progressTimerRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime || !player?.getDuration) return;
      setCurrentTime(player.getCurrentTime());
      setDuration(player.getDuration());
    }, PROGRESS_INTERVAL_MS);
  }, [stopProgress]);

  useEffect(() => {
    let cancelled = false;

    function createPlayer() {
      if (cancelled || !targetRef.current || playerRef.current) return;
      playerRef.current = new window.YT.Player(targetRef.current, {
        videoId: trackIdRef.current,
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          fs: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            setDuration(playerRef.current?.getDuration() ?? 0);
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setPlaying(true);
              startProgress();
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setPlaying(false);
              stopProgress();
              onEndedRef.current();
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setPlaying(false);
              stopProgress();
            }
          },
          onError: () => {
            setPlaying(false);
            stopProgress();
            onErrorRef.current();
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
      stopProgress();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [startProgress, stopProgress]);

  useEffect(() => {
    trackIdRef.current = track.youtubeVideoId;
    const resetTimer = setTimeout(() => {
      setCurrentTime(0);
      setDuration(0);
    }, 0);
    const player = playerRef.current;
    if (ready && player) {
      if (startedRef.current) {
        player.loadVideoById(track.youtubeVideoId);
      } else {
        player.cueVideoById(track.youtubeVideoId);
      }
    }
    return () => clearTimeout(resetTimer);
  }, [ready, track.youtubeVideoId]);

  function startPlayback() {
    startedRef.current = true;
    setStarted(true);
    playerRef.current?.playVideo();
  }

  function togglePlayback() {
    if (!startedRef.current) {
      startPlayback();
    } else if (playing) {
      playerRef.current?.pauseVideo();
    } else {
      playerRef.current?.playVideo();
    }
  }

  function changeVolume(value: number) {
    setVolume(value);
    playerRef.current?.setVolume(value);
    if (value === 0) {
      playerRef.current?.mute();
      setMuted(true);
    } else if (muted) {
      playerRef.current?.unMute();
      setMuted(false);
    }
  }

  function toggleMute() {
    if (muted) {
      playerRef.current?.unMute();
      setMuted(false);
    } else {
      playerRef.current?.mute();
      setMuted(true);
    }
  }

  function seek(value: number) {
    playerRef.current?.seekTo(value, true);
    setCurrentTime(value);
  }

  function formatTime(value: number) {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  return (
    <div ref={containerRef} className="overflow-hidden rounded-2xl border bg-card">
      <div className="relative aspect-video bg-black">
        <div className="pointer-events-none absolute inset-0">
          <div ref={targetRef} className="h-full w-full" title={track.title} />
        </div>
        {!started && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <Button
              size="lg"
              className="rounded-full px-8"
              disabled={!ready}
              onClick={startPlayback}
            >
              <Play className="mr-2 h-5 w-5 fill-current" />
              Play Music
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4 p-4">
        <div>
          <h1 className="line-clamp-2 text-xl font-bold">{track.title}</h1>
          <p className="text-sm text-muted-foreground">{track.channelTitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(duration, 1)}
            step={1}
            value={Math.min(currentTime, Math.max(duration, 1))}
            onChange={(event) => seek(Number(event.target.value))}
            className="h-1 flex-1 cursor-pointer accent-primary"
            aria-label="Playback position"
          />
          <span className="w-10 text-xs tabular-nums text-muted-foreground">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={!hasPrevious}
            onClick={onPrevious}
            aria-label="Previous track"
          >
            <SkipBack className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={togglePlayback}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            aria-label="Next track"
          >
            <SkipForward className="h-5 w-5" />
          </Button>

          <div className="ml-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <input
              type="range"
              min={0}
              max={100}
              value={muted ? 0 : volume}
              onChange={(event) => changeVolume(Number(event.target.value))}
              className="w-24 accent-primary"
              aria-label="Volume"
            />
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
