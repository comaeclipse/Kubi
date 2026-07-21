import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  LOCKOUT_MS,
  attemptsRemaining,
  grantParentUnlock,
  isValidPin,
  revokeParentUnlock,
  shouldLockOut,
  verifyPinHash,
} from "@/lib/parent-pin";

// Exchange the parent PIN for a short-lived unlock ticket (an HMAC-signed
// cookie). Every parent-only write checks for that ticket via requireParent().
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { pin } = await request.json().catch(() => ({}));

    const [row] = await db
      .select({
        parentPinHash: users.parentPinHash,
        pinFailedAttempts: users.pinFailedAttempts,
        pinLockedUntil: users.pinLockedUntil,
      })
      .from(users)
      .where(eq(users.id, auth.id));
    if (!row || row.parentPinHash === null) {
      return NextResponse.json({ error: "No PIN is set" }, { status: 409 });
    }

    if (row.pinLockedUntil && row.pinLockedUntil.getTime() > Date.now()) {
      return NextResponse.json(
        { error: "too_many_attempts", lockedUntil: row.pinLockedUntil },
        { status: 429 }
      );
    }

    // Shape check before the (deliberately slow) bcrypt compare.
    const ok =
      isValidPin(pin) && (await verifyPinHash(pin, row.parentPinHash));

    if (!ok) {
      // The lockout window has passed if we got here, so a stale count from a
      // previous lockout starts over rather than locking on the first miss.
      const stale =
        row.pinLockedUntil !== null &&
        row.pinLockedUntil.getTime() <= Date.now();
      const failed = (stale ? 0 : row.pinFailedAttempts) + 1;
      const lockedUntil = shouldLockOut(failed)
        ? new Date(Date.now() + LOCKOUT_MS)
        : null;
      await db
        .update(users)
        .set({
          pinFailedAttempts: lockedUntil ? 0 : failed,
          pinLockedUntil: lockedUntil,
        })
        .where(eq(users.id, auth.id));

      if (lockedUntil) {
        return NextResponse.json(
          { error: "too_many_attempts", lockedUntil },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "incorrect_pin", attemptsRemaining: attemptsRemaining(failed) },
        { status: 401 }
      );
    }

    if (row.pinFailedAttempts !== 0 || row.pinLockedUntil !== null) {
      await db
        .update(users)
        .set({ pinFailedAttempts: 0, pinLockedUntil: null })
        .where(eq(users.id, auth.id));
    }

    const unlockedUntil = await grantParentUnlock(auth.id);
    return NextResponse.json({ ok: true, unlockedUntil });
  } catch {
    return NextResponse.json({ error: "Failed to verify PIN" }, { status: 500 });
  }
}

// Lock the parent screens again without waiting for the ticket to expire.
export async function DELETE() {
  await revokeParentUnlock();
  return NextResponse.json({ ok: true });
}
