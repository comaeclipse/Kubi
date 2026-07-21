import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireParent, destroySession } from "@/lib/auth";

// Deletes the authenticated user's account. Cascade constraints on the schema
// remove sessions, profiles, playlists, user_channels, and email_tokens.
export async function DELETE() {
  try {
    const auth = await requireParent();
    if (auth instanceof NextResponse) return auth;

    if (auth.isDemo) {
      return NextResponse.json(
        { error: "Demo accounts cannot be deleted" },
        { status: 403 }
      );
    }

    await db.delete(users).where(eq(users.id, auth.id));
    await destroySession();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
