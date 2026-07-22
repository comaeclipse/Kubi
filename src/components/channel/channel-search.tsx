"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ChannelAvatar } from "@/components/channel/channel-avatar";

// Below this we don't call YouTube at all — see MIN_QUERY_LENGTH server-side.
const MIN_QUERY_LENGTH = 3;
// Long enough that typing a channel name is one API call, not eight.
const DEBOUNCE_MS = 500;

export interface SearchableChannel {
  id: number;
  title: string;
  thumbnailUrl: string | null;
}

interface YouTubeResult {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  existingChannelId: number | null;
}

// Generic over the library item so callers keep their own richer channel type
// (the profile page's carries an `enabled` flag) through the select callback.
interface ChannelSearchProps<T extends SearchableChannel> {
  /** Everything already in this account's library, for the free instant group. */
  library: T[];
  /** Channel ids already approved for this profile. */
  approvedIds: Set<number>;
  /** Approve a channel we already hold. */
  onSelectLocal: (channel: T) => Promise<void>;
  /** Add a channel from YouTube, then approve it. */
  onSelectYouTube: (result: YouTubeResult) => Promise<void>;
}

// "Add channels" combobox. Two groups, deliberately:
//
//   In your library  — filtered client-side, instant and free.
//   From YouTube     — debounced, server-cached, quota-capped.
//
// The local group means the common case (a channel we already hold) never
// spends an API unit, and the parent gets feedback on the first keystroke.
export function ChannelSearch<T extends SearchableChannel>({
  library,
  approvedIds,
  onSelectLocal,
  onSelectYouTube,
}: ChannelSearchProps<T>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [ytResults, setYtResults] = useState<YouTubeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();

  const localMatches = trimmed
    ? library
        .filter((c) => c.title.toLowerCase().includes(trimmed.toLowerCase()))
        .slice(0, 6)
    : [];

  // Debounced YouTube lookup. The timer is cleared on every keystroke, so a
  // burst of typing resolves to exactly one request once the parent pauses.
  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setYtResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/youtube/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!res.ok) {
          setYtResults([]);
          setSearchError(data.error ?? "Search failed. Please try again.");
          return;
        }
        setYtResults(Array.isArray(data.results) ? data.results : []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setSearchError("Search failed. Please try again.");
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  // Close on outside click so the dropdown doesn't hang over the page.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const reset = useCallback(() => {
    setQuery("");
    setYtResults([]);
    setOpen(false);
  }, []);

  async function pickLocal(channel: T) {
    if (approvedIds.has(channel.id)) return;
    setPending(String(channel.id));
    try {
      await onSelectLocal(channel);
      reset();
    } finally {
      setPending(null);
    }
  }

  async function pickYouTube(result: YouTubeResult) {
    if (result.existingChannelId && approvedIds.has(result.existingChannelId)) {
      return;
    }
    setPending(result.channelId);
    try {
      await onSelectYouTube(result);
      reset();
    } finally {
      setPending(null);
    }
  }

  const showList = open && trimmed.length > 0;
  const nothingYet =
    !searching &&
    localMatches.length === 0 &&
    ytResults.length === 0 &&
    !searchError;

  return (
    <div ref={containerRef} className="relative">
      {/* shouldFilter={false}: the local group is filtered above and the
          YouTube group is ranked by YouTube — cmdk must not re-filter either. */}
      <Command shouldFilter={false} className="overflow-visible bg-transparent">
        <div className="rounded-md border">
          <CommandInput
            placeholder="Search YouTube for a channel to add…"
            value={query}
            onValueChange={(value) => {
              setQuery(value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>

        {showList && (
          <div className="absolute top-full right-0 left-0 z-50 mt-1 rounded-md border bg-popover shadow-md">
            <CommandList>
              {localMatches.length > 0 && (
                <CommandGroup heading="In your library">
                  {localMatches.map((channel) => {
                    const already = approvedIds.has(channel.id);
                    return (
                      <CommandItem
                        key={`local-${channel.id}`}
                        value={`local-${channel.id}`}
                        onSelect={() => pickLocal(channel)}
                        disabled={already}
                      >
                        <ChannelAvatar
                          title={channel.title}
                          thumbnailUrl={channel.thumbnailUrl}
                          className="h-7 w-7 shrink-0 rounded-full text-xs"
                        />
                        <span className="flex-1 truncate">{channel.title}</span>
                        {already ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Check className="h-3 w-3" />
                            Approved
                          </span>
                        ) : pending === String(channel.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {localMatches.length > 0 && ytResults.length > 0 && (
                <CommandSeparator />
              )}

              {ytResults.length > 0 && (
                <CommandGroup heading="From YouTube">
                  {ytResults.map((result) => {
                    const already =
                      result.existingChannelId !== null &&
                      approvedIds.has(result.existingChannelId);
                    return (
                      <CommandItem
                        key={`yt-${result.channelId}`}
                        value={`yt-${result.channelId}`}
                        onSelect={() => pickYouTube(result)}
                        disabled={already}
                      >
                        <ChannelAvatar
                          title={result.title}
                          thumbnailUrl={result.thumbnailUrl}
                          className="h-7 w-7 shrink-0 rounded-full text-xs"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{result.title}</span>
                          {result.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {result.description}
                            </span>
                          )}
                        </span>
                        {already ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Check className="h-3 w-3" />
                            Approved
                          </span>
                        ) : pending === result.channelId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {searching && (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching YouTube…
                </div>
              )}

              {searchError && (
                <div className="px-3 py-3 text-sm text-destructive">
                  {searchError}
                </div>
              )}

              {nothingYet && (
                <CommandEmpty>
                  {trimmed.length < MIN_QUERY_LENGTH
                    ? `Keep typing — ${MIN_QUERY_LENGTH} characters to search YouTube.`
                    : "No channels found."}
                </CommandEmpty>
              )}
            </CommandList>
          </div>
        )}
      </Command>
    </div>
  );
}
