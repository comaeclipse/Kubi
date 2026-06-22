import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import { encrypt, emailBlindIndex, normalizeEmail } from "@/lib/crypto";
import { isValidEmail, isValidPassword } from "@/lib/validation";
import { issueEmailToken, VERIFY_TTL_MS } from "@/lib/email-tokens";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address" },
        { status: 400 }
      );
    }
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const emailHash = emailBlindIndex(email);
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.emailHash, emailHash));

    if (existing) {
      // Avoid leaking which emails are registered.
      return NextResponse.json({ success: true });
    }

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const [user] = await db
      .insert(users)
      .values({
        emailHash,
        email: encrypt(normalizeEmail(email)),
        passwordHash: await hashPassword(password),
        trialEndsAt,
      })
      .returning({ id: users.id });

    const token = await issueEmailToken(user.id, "verify", VERIFY_TTL_MS);
    await sendVerificationEmail(normalizeEmail(email), token);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[register] failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
