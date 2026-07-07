import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSubscription, normalizePayPalStatus } from "@/lib/paypal";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Called once by the success page on PayPal return to fetch + write the
// subscription status immediately, removing the dependency on (laggy, in
// sandbox) webhook delivery. The webhook remains the source of truth for later
// lifecycle changes; this just unblocks the first activation.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscriptionId =
    new URL(request.url).searchParams.get("subscription_id") ?? user.subscriptionId;
  if (!subscriptionId) {
    return NextResponse.json({ error: "No subscription id" }, { status: 400 });
  }

  const sub = await getSubscription(subscriptionId);

  // Guard against confirming a subscription that isn't this user's.
  if (sub.custom_id && Number(sub.custom_id) !== user.id) {
    return NextResponse.json({ error: "Subscription mismatch" }, { status: 403 });
  }

  await db
    .update(users)
    .set({
      billingProvider: "paypal",
      subscriptionId: sub.id,
      subscriptionStatus: normalizePayPalStatus(sub.status),
      currentPeriodEndsAt: sub.billing_info?.next_billing_time
        ? new Date(sub.billing_info.next_billing_time)
        : null,
    })
    .where(eq(users.id, user.id));

  return NextResponse.json({ ok: true, status: normalizePayPalStatus(sub.status) });
}
