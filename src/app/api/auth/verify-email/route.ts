import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { consumeEmailToken } from "@/lib/email-tokens";
import { checkBotId } from "botid/server";

async function verify(token: string | null) {
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const userId = await consumeEmailToken(token, "verify");
  if (!userId) {
    return NextResponse.json(
      { error: "Invalid or expired link" },
      { status: 400 }
    );
  }
  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, userId));
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  try {
    const { isBot } = await checkBotId();
    if (isBot) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const { token } = await request.json();
    return await verify(typeof token === "string" ? token : null);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  return verify(token);
}
