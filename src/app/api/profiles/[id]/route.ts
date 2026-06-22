import { NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { name, avatarColor } = await request.json();

    const updates: Record<string, string> = {};
    let plainName: string | undefined;
    if (name && typeof name === "string" && name.trim().length > 0) {
      plainName = name.trim();
      updates.name = encrypt(plainName);
    }
    if (avatarColor && typeof avatarColor === "string") {
      updates.avatarColor = avatarColor;
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
    const auth = await requireUser();
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
