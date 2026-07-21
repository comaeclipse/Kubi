import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { profiles, profileUsage } from "@/db/schema";
import { HEARTBEAT_SECONDS, type UsageSnapshot } from "@/lib/time-limit";

// A single heartbeat may bank a little over one interval and no more. Without
// this cap, a tab left open overnight (or resumed from sleep) would charge the
// child for hours they never spent in the app.
const MAX_TICK_SECONDS = Math.round(HEARTBEAT_SECONDS * 1.5);

/**
 * Falls back to UTC for a missing or unrecognized zone rather than throwing —
 * a bogus `timeZone` should cost the child a slightly odd day boundary, not a
 * failed request.
 */
export function resolveTimeZone(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: raw });
    return raw;
  } catch {
    return "UTC";
  }
}

/**
 * The child's local calendar day. The client says which zone it is in, but
 * never what time it is, so winding the device clock forward can't hand out a
 * fresh day's allowance. `en-CA` formats as YYYY-MM-DD.
 */
export function localDate(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function snapshot(
  usageDate: string,
  limitMinutes: number | null,
  secondsUsed: number
): UsageSnapshot {
  if (limitMinutes === null) {
    return {
      usageDate,
      limitMinutes: null,
      secondsUsed,
      remainingSeconds: null,
      expired: false,
    };
  }
  const remainingSeconds = Math.max(0, limitMinutes * 60 - secondsUsed);
  return {
    usageDate,
    limitMinutes,
    secondsUsed,
    remainingSeconds,
    expired: remainingSeconds === 0,
  };
}

/** The profile's limit, or `null` if it doesn't belong to this account. */
async function getLimitMinutes(
  userId: number,
  profileId: number
): Promise<{ limitMinutes: number | null } | null> {
  if (!Number.isFinite(profileId)) return null;
  const [row] = await db
    .select({ limitMinutes: profiles.dailyLimitMinutes })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Today's tally without banking any time. */
export async function readUsage(
  userId: number,
  profileId: number,
  timeZone: string
): Promise<UsageSnapshot | null> {
  const profile = await getLimitMinutes(userId, profileId);
  if (!profile) return null;

  const usageDate = localDate(timeZone);
  const [row] = await db
    .select({ secondsUsed: profileUsage.secondsUsed })
    .from(profileUsage)
    .where(
      and(
        eq(profileUsage.profileId, profileId),
        eq(profileUsage.usageDate, usageDate)
      )
    )
    .limit(1);

  return snapshot(usageDate, profile.limitMinutes, row?.secondsUsed ?? 0);
}

/**
 * Banks the time since the last heartbeat and returns the updated tally.
 *
 * The client never sends a duration — the elapsed seconds come from the gap
 * between `now()` and the row's own `updated_at`, so the tally is entirely
 * server-authoritative. `resume` banks nothing and only restarts the clock; the
 * client sends it when a profile is picked or a hidden tab comes back, so the
 * time the app spent closed isn't charged to the child.
 */
export async function recordHeartbeat(
  userId: number,
  profileId: number,
  timeZone: string,
  resume: boolean
): Promise<UsageSnapshot | null> {
  const profile = await getLimitMinutes(userId, profileId);
  if (!profile) return null;

  const usageDate = localDate(timeZone);
  const cap = resume ? 0 : MAX_TICK_SECONDS;

  const [row] = await db
    .insert(profileUsage)
    .values({ profileId, usageDate, secondsUsed: 0 })
    .onConflictDoUpdate({
      target: [profileUsage.profileId, profileUsage.usageDate],
      set: {
        secondsUsed: sql`${profileUsage.secondsUsed} + LEAST(GREATEST(EXTRACT(EPOCH FROM (now() - ${profileUsage.updatedAt}))::int, 0), ${cap})`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ secondsUsed: profileUsage.secondsUsed });

  return snapshot(usageDate, profile.limitMinutes, row?.secondsUsed ?? 0);
}

/** Clears today's tally — the parent granting a fresh allowance. */
export async function resetUsage(
  userId: number,
  profileId: number,
  timeZone: string
): Promise<UsageSnapshot | null> {
  const profile = await getLimitMinutes(userId, profileId);
  if (!profile) return null;

  const usageDate = localDate(timeZone);
  await db
    .delete(profileUsage)
    .where(
      and(
        eq(profileUsage.profileId, profileId),
        eq(profileUsage.usageDate, usageDate)
      )
    );

  return snapshot(usageDate, profile.limitMinutes, 0);
}
