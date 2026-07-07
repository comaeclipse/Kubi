import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  verifyWebhookSignature,
  getSubscription,
  normalizePayPalStatus,
} from "@/lib/paypal";

// Resolve the target user from a subscription resource. Prefer the subscription
// id (persisted synchronously by the subscribe route), fall back to custom_id
// (the user id) in case the activation event races ahead of that write.
async function findUser(opts: {
  subscriptionId?: string | null;
  customId?: string | null;
}) {
  if (opts.subscriptionId) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.subscriptionId, opts.subscriptionId));
    if (row) return row;
  }
  if (opts.customId) {
    const id = Number(opts.customId);
    if (Number.isFinite(id)) {
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id));
      if (row) return row;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  let verified: boolean;
  try {
    verified = await verifyWebhookSignature(request.headers, rawBody);
  } catch (err) {
    console.error("[paypal webhook] verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const eventType: string = event.event_type;
  const resource = event.resource ?? {};

  try {
    switch (eventType) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "BILLING.SUBSCRIPTION.UPDATED":
      case "BILLING.SUBSCRIPTION.SUSPENDED":
      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        // resource is the subscription object.
        const subscriptionId: string | undefined = resource.id;
        const target = await findUser({
          subscriptionId,
          customId: resource.custom_id,
        });
        if (!target) break;

        const nextBilling: string | undefined = resource.billing_info?.next_billing_time;
        await db
          .update(users)
          .set({
            billingProvider: "paypal",
            subscriptionId: subscriptionId ?? undefined,
            subscriptionStatus: normalizePayPalStatus(resource.status),
            currentPeriodEndsAt: nextBilling ? new Date(nextBilling) : null,
          })
          .where(eq(users.id, target.id));
        break;
      }

      case "PAYMENT.SALE.COMPLETED": {
        // Renewal payment. resource.billing_agreement_id is the subscription id.
        const subscriptionId: string | undefined = resource.billing_agreement_id;
        if (!subscriptionId) break;
        const target = await findUser({ subscriptionId });
        if (!target) break;

        // Re-fetch the subscription to refresh the period end + status.
        const sub = await getSubscription(subscriptionId);
        await db
          .update(users)
          .set({
            subscriptionStatus: normalizePayPalStatus(sub.status),
            currentPeriodEndsAt: sub.billing_info?.next_billing_time
              ? new Date(sub.billing_info.next_billing_time)
              : null,
          })
          .where(eq(users.id, target.id));
        break;
      }
    }
  } catch (err) {
    console.error("[paypal webhook] handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
