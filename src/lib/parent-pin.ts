import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

import { signPayload, verifyPayloadSignature } from "@/lib/crypto";

// Parent PIN: a 4-digit code that stands between a kid holding the tablet and
// the screens where a parent changes time limits, blocked words, approved
// channels, or the account itself.
//
// It is a child lock, not an authentication factor — the session cookie is
// still what proves who you are. Entering the PIN mints a short-lived,
// HMAC-signed "unlock" cookie; every parent-only route requires both.

const UNLOCK_COOKIE = "parent_unlock";
// Long enough to work through the manage screens, short enough that a tablet
// left on the couch re-locks itself.
export const UNLOCK_MAX_AGE_SECONDS = 15 * 60;

// Consecutive wrong entries before entry is frozen, and for how long. 10k
// combinations means an unthrottled PIN is guessable; this makes it not.
const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS = 5 * 60 * 1000;

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export function verifyPinHash(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export function shouldLockOut(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_ATTEMPTS;
}

export function attemptsRemaining(failedAttempts: number): number {
  return Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts);
}

// Ticket format: "<userId>.<expiresAtMs>.<hmac>". Bound to the user id so a
// ticket can't survive a logout into someone else's session on the same device.
function ticketPayload(userId: number, expiresAt: number): string {
  return `${userId}.${expiresAt}`;
}

export async function grantParentUnlock(userId: number): Promise<Date> {
  const expiresAt = new Date(Date.now() + UNLOCK_MAX_AGE_SECONDS * 1000);
  const payload = ticketPayload(userId, expiresAt.getTime());
  const cookieStore = await cookies();
  cookieStore.set(UNLOCK_COOKIE, `${payload}.${signPayload(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: UNLOCK_MAX_AGE_SECONDS,
    expires: expiresAt,
    path: "/",
  });
  return expiresAt;
}

export async function revokeParentUnlock(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(UNLOCK_COOKIE);
}

// Returns when the current unlock expires, or null if there isn't a valid one.
export async function getParentUnlockExpiry(
  userId: number
): Promise<Date | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(UNLOCK_COOKIE)?.value;
  if (!raw) return null;

  const [rawUserId, rawExpiresAt, signature] = raw.split(".");
  if (!rawUserId || !rawExpiresAt || !signature) return null;
  if (Number(rawUserId) !== userId) return null;

  const expiresAt = Number(rawExpiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  if (!verifyPayloadSignature(ticketPayload(userId, expiresAt), signature)) {
    return null;
  }
  return new Date(expiresAt);
}
