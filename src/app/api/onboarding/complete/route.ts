import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, userChannels, users } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { visibleChannel } from "@/lib/channel-visibility";
import { checkBotId } from "botid/server";

// Finishes first-run onboarding: enables the chosen master-library channels for
// the account and stamps `onboarded_at` so the modal never shows again. Called
// for both "enable selected" and "skip" (with an empty list).
export async function POST(request: Request) {
  try {
    const { isBot } = await checkBotId();
    if (isBot) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const auth = await requireUser();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const raw: unknown = body?.channelIds;
    const requestedIds = Array.isArray(raw)
      ? raw.filter((n): n is number => Number.isInteger(n))
      : [];

    if (requestedIds.length > 0) {
      // Only enable ids the caller may actually see (master or their own).
      const valid = await db
        .select({ id: channels.id })
        .from(channels)
        .where(and(inArray(channels.id, requestedIds), visibleChannel(auth.id)));

      if (valid.length > 0) {
        await db
          .insert(userChannels)
          .values(valid.map((c) => ({ userId: auth.id, channelId: c.id })))
          .onConflictDoNothing();
      }
    }

    await db
      .update(users)
      .set({ onboardedAt: new Date() })
      .where(eq(users.id, auth.id));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
