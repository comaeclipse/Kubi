"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, Video, Ban, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChannelResult {
  channelId: number;
  title: string;
  newVideos: number;
  skippedShorts: number;
  error?: string;
}

interface RunRecord {
  ranAt: string;
  totalNewVideos: number;
  totalShortsSkipped: number;
  channels: ChannelResult[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CronStatus() {
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(0);

  async function runNow() {
    setRunning(true);
    try {
      await fetch("/api/admin/cron-run", { method: "POST" });
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const data = await fetch("/api/admin/cron-status").then((r) => r.json());
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Daily Auto-Sync
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={runNow}
              disabled={running || loading}
              className="h-7 gap-1.5 text-xs"
            >
              <Play className={`h-3 w-3 ${running ? "animate-pulse" : ""}`} />
              {running ? "Running…" : "Run Now"}
            </Button>
            <Button variant="ghost" size="icon" onClick={load} disabled={loading || running}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No runs recorded yet. The cron runs daily at 4:00 AM UTC.
          </p>
        ) : (
          history.map((run, i) => {
            const hasErrors = run.channels.some((c) => c.error);
            return (
              <div key={run.ranAt} className="rounded-lg border text-sm">
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <span className="font-medium tabular-nums shrink-0">
                    {formatDate(run.ranAt)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {timeAgo(run.ranAt)}
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    {hasErrors && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        error
                      </Badge>
                    )}
                    <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                      <Video className="h-2.5 w-2.5" />
                      +{run.totalNewVideos}
                    </Badge>
                    {run.totalShortsSkipped > 0 && (
                      <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 text-muted-foreground">
                        <Ban className="h-2.5 w-2.5" />
                        {run.totalShortsSkipped} shorts
                      </Badge>
                    )}
                  </div>
                </button>

                {expanded === i && (
                  <div className="border-t px-4 py-3 space-y-1.5">
                    {run.channels.map((ch) => (
                      <div key={ch.channelId} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground truncate flex-1">
                          {ch.title}
                        </span>
                        {ch.error ? (
                          <span className="text-destructive shrink-0">{ch.error}</span>
                        ) : (
                          <>
                            <span className="text-green-600 dark:text-green-400 shrink-0 tabular-nums">
                              +{ch.newVideos} video{ch.newVideos !== 1 ? "s" : ""}
                            </span>
                            {ch.skippedShorts > 0 && (
                              <span className="text-muted-foreground shrink-0 tabular-nums">
                                {ch.skippedShorts} short{ch.skippedShorts !== 1 ? "s" : ""} skipped
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
