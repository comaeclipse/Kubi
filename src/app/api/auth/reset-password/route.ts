import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, destroyAllSessions } from "@/lib/auth";
import { consumeEmailToken } from "@/lib/email-tokens";
import { isValidPassword } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (typeof token !== "string" || !token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const userId = await consumeEmailToken(token, "reset");
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 400 }
      );
    }

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(password), emailVerified: true })
      .where(eq(users.id, userId));

    // A successful reset proves email control, so verify it; invalidate any
    // existing sessions so a previously-leaked password can't keep a session.
    await destroyAllSessions(userId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
