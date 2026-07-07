import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelSubscription } from "@/lib/paypal";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkBotId } from "botid/server";

export async function POST() {
  const { isBot } = await checkBotId();
  if (isBot) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.billingProvider !== "paypal" || !user.subscriptionId) {
    return NextResponse.json({ error: "No PayPal subscription" }, { status: 400 });
  }

  await cancelSubscription(user.subscriptionId, "Cancelled from Kubi");

  // Optimistically reflect the cancel; the CANCELLED webhook will confirm.
  await db
    .update(users)
    .set({ subscriptionStatus: "canceled" })
    .where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
