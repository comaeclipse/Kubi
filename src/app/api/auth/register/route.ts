import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import { encrypt, emailBlindIndex, normalizeEmail } from "@/lib/crypto";
import { isValidEmail, isValidPassword } from "@/lib/validation";
import { issueEmailToken, VERIFY_TTL_MS } from "@/lib/email-tokens";
import { sendVerificationEmail } from "@/lib/email";
import { checkBotId } from "botid/server";
import { findUsableInvite } from "@/lib/invites";

export async function POST(request: Request) {
  try {
    const { isBot } = await checkBotId();
    if (isBot) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const { email, password, invite: inviteCode } = await request.json();

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

    // Resolve invite code — invalid/expired/maxed codes fall back silently to
    // normal unverified registration rather than blocking the signup.
    const invite =
      typeof inviteCode === "string" && inviteCode
        ? await findUsableInvite(inviteCode)
        : null;

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const [user] = await db
      .insert(users)
      .values({
        emailHash,
        email: encrypt(normalizeEmail(email)),
        passwordHash: await hashPassword(password),
        emailVerified: invite ? true : false,
        invitedVia: invite ? invite.id : null,
        trialEndsAt,
      })
      .returning({ id: users.id });

    if (!invite) {
      const token = await issueEmailToken(user.id, "verify", VERIFY_TTL_MS);
      await sendVerificationEmail(normalizeEmail(email), token);
    }

    return NextResponse.json({ success: true, invited: Boolean(invite) });
  } catch (err) {
    console.error("[register] failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
