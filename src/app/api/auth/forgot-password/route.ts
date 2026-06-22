import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt, emailBlindIndex } from "@/lib/crypto";
import { issueEmailToken, RESET_TTL_MS } from "@/lib/email-tokens";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    // Always respond 200 to avoid revealing whether an account exists.
    if (typeof email === "string" && email.includes("@")) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.emailHash, emailBlindIndex(email)));

      if (user) {
        const token = await issueEmailToken(user.id, "reset", RESET_TTL_MS);
        await sendPasswordResetEmail(decrypt(user.email), token);
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
