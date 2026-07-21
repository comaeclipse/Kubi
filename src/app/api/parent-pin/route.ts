import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser, verifyPassword } from "@/lib/auth";
import {
  grantParentUnlock,
  hashPin,
  isValidPin,
  verifyPinHash,
} from "@/lib/parent-pin";

// Create the account's parent PIN. Only valid while no PIN exists — this is the
// first-run path (onboarding, and the one-time prompt existing accounts get the
// next time they open a parent screen). Changing an existing PIN goes through
// PATCH, which demands proof first.
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    if (auth.hasPin) {
      return NextResponse.json(
        { error: "A PIN is already set" },
        { status: 409 }
      );
    }

    const { pin } = await request.json().catch(() => ({}));
    if (!isValidPin(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4 digits" },
        { status: 400 }
      );
    }

    await db
      .update(users)
      .set({
        parentPinHash: await hashPin(pin),
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      })
      .where(eq(users.id, auth.id));

    // Setting the PIN unlocks the screen the parent was already on.
    const unlockedUntil = await grantParentUnlock(auth.id);
    return NextResponse.json({ ok: true, unlockedUntil });
  } catch {
    return NextResponse.json({ error: "Failed to set PIN" }, { status: 500 });
  }
}

// Change (or reset) the PIN. Proof is either the current PIN — the normal path
// from the parent screen — or the account password, which is the recovery path
// for a parent who has forgotten the PIN. Both are things a kid doesn't have.
export async function PATCH(request: Request) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { pin, currentPin, password } = await request
      .json()
      .catch(() => ({}));
    if (!isValidPin(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4 digits" },
        { status: 400 }
      );
    }

    const [row] = await db
      .select({
        parentPinHash: users.parentPinHash,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, auth.id));
    if (!row) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let proven = false;
    if (typeof password === "string" && password.length > 0) {
      proven = await verifyPassword(password, row.passwordHash);
      if (!proven) {
        return NextResponse.json(
          { error: "That password isn't right" },
          { status: 401 }
        );
      }
    } else if (row.parentPinHash === null) {
      // No PIN to prove against — POST is the route for that.
      return NextResponse.json({ error: "No PIN is set" }, { status: 409 });
    } else {
      proven =
        isValidPin(currentPin) &&
        (await verifyPinHash(currentPin, row.parentPinHash));
      if (!proven) {
        return NextResponse.json(
          { error: "That PIN isn't right" },
          { status: 401 }
        );
      }
    }

    await db
      .update(users)
      .set({
        parentPinHash: await hashPin(pin),
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      })
      .where(eq(users.id, auth.id));

    const unlockedUntil = await grantParentUnlock(auth.id);
    return NextResponse.json({ ok: true, unlockedUntil });
  } catch {
    return NextResponse.json({ error: "Failed to change PIN" }, { status: 500 });
  }
}
