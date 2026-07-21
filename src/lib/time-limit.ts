// Shared vocabulary for the per-profile daily time limit. Deliberately free of
// database imports so the client heartbeat can use it too.

/** How often the client banks time while a limited profile is on screen. */
export const HEARTBEAT_SECONDS = 30;

/** Show the child a heads-up once they drop below this much time. */
export const WARNING_SECONDS = 5 * 60;

export interface UsageSnapshot {
  /** The child's local day this tally belongs to, YYYY-MM-DD. */
  usageDate: string;
  /** Null when the profile has no limit configured. */
  limitMinutes: number | null;
  secondsUsed: number;
  /** Null when unlimited; never negative otherwise. */
  remainingSeconds: number | null;
  expired: boolean;
}

/** "45 minutes", "1 hour", "1 hour 30 minutes" — spelled out for parents. */
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  return parts.join(" ") || "0 minutes";
}
