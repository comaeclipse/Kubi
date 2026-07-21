import { NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireParent } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import {
  isValidDailyLimit,
  normalizeBlockedKeywords,
} from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireParent();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();
    const { name, avatarColor, blockedKeywords, dailyLimitMinutes } = body;

    const updates: Partial<typeof profiles.$inferInsert> = {};
    let plainName: string | undefined;
    if (name && typeof name === "string" && name.trim().length > 0) {
      plainName = name.trim();
      updates.name = encrypt(plainName);
    }
    if (avatarColor && typeof avatarColor === "string") {
      updates.avatarColor = avatarColor;
    }
    if (blockedKeywords !== undefined) {
      const normalized = normalizeBlockedKeywords(blockedKeywords);
      if (!normalized) {
        return NextResponse.json(
          { error: "blockedKeywords must be an array of words" },
          { status: 400 }
        );
      }
      updates.blockedKeywords = normalized;
    }
    // Explicit null clears the limit, so presence — not truthiness — decides
    // whether this field is being changed.
    if (dailyLimitMinutes !== undefined) {
      if (!isValidDailyLimit(dailyLimitMinutes)) {
        return NextResponse.json(
          { error: "dailyLimitMinutes must be null or 5–1440" },
          { status: 400 }
        );
      }
      updates.dailyLimitMinutes = dailyLimitMinutes;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Scope the update to this user's own profile.
    const [updated] = await db
      .update(profiles)
      .set(updates)
      .where(
        and(eq(profiles.id, parseInt(id)), eq(profiles.userId, auth.id))
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...updated,
      name: plainName ?? undefined,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireParent();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await db
      .delete(profiles)
      .where(
        and(eq(profiles.id, parseInt(id)), eq(profiles.userId, auth.id))
      );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete profile" },
      { status: 500 }
    );
  }
}
