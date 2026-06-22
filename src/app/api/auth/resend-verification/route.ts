import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt, emailBlindIndex } from "@/lib/crypto";
import { issueEmailToken, VERIFY_TTL_MS } from "@/lib/email-tokens";
import { sendVerificationEmail } from "@/lib/email";
import { checkBotId } from "botid/server";

export async function POST(request: Request) {
  try {
    const { isBot } = await checkBotId();
    if (isBot) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const { email } = await request.json();

    // Always respond 200 (no account enumeration).
    if (typeof email === "string" && email.includes("@")) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.emailHash, emailBlindIndex(email)));

      if (user && !user.emailVerified) {
        const token = await issueEmailToken(user.id, "verify", VERIFY_TTL_MS);
        await sendVerificationEmail(decrypt(user.email), token);
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
