import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSubscription } from "@/lib/paypal";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkBotId } from "botid/server";

export async function POST() {
  const { isBot } = await checkBotId();
  if (isBot) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Email not verified" }, { status: 403 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { id, approveUrl } = await createSubscription(user.id, {
    returnUrl: `${appUrl}/subscribe/success`,
    cancelUrl: `${appUrl}/subscribe`,
  });

  // Persist the subscription id synchronously (before redirect) so the
  // activation webhook can find this user by subscriptionId even if it lands
  // before the success page returns. Status stays null until the webhook
  // confirms ACTIVATED.
  await db
    .update(users)
    .set({ billingProvider: "paypal", subscriptionId: id })
    .where(eq(users.id, user.id));

  return NextResponse.json({ url: approveUrl });
}
