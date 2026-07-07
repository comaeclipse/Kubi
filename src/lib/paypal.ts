/**
 * Server-only PayPal REST client (Subscriptions API v1).
 *
 * Mirrors the per-integration module style of `lib/bunny.ts`: module-const
 * secrets read from the environment, raw `fetch`, `if (!res.ok) throw`. No
 * PayPal Node SDK — the v1 subscriptions SDK is deprecated/unmaintained.
 *
 * IMPORTANT: never import this module into a client component — it reads the
 * PayPal client secret from the environment.
 */

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PLAN_ID = process.env.PAYPAL_PLAN_ID;
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;
const API_BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

// Normalized subscription status strings shared with the Stripe side, so
// computeHasAccess() in lib/auth.ts stays provider-agnostic.
export type NormalizedStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete";

/** Map the PayPal subscription status enum to our internal status strings. */
export function normalizePayPalStatus(status: string | null | undefined): NormalizedStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "SUSPENDED":
      return "past_due";
    case "CANCELLED":
    case "EXPIRED":
      return "canceled";
    case "APPROVAL_PENDING":
    case "APPROVED":
    default:
      return "incomplete";
  }
}

/**
 * Fetch an OAuth2 bearer token via client-credentials. No caching initially —
 * one token fetch per request is fine at this scale; add a short in-memory TTL
 * cache if call volume grows.
 */
export async function getAccessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not configured");
  }

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PayPal token error (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

type PayPalLink = { rel: string; href: string; method?: string };

export interface PayPalSubscription {
  id: string;
  status: string;
  custom_id?: string;
  billing_info?: {
    next_billing_time?: string;
  };
  links?: PayPalLink[];
}

/**
 * Create a subscription against PAYPAL_PLAN_ID. Charges immediately on approval
 * (the plan has no TRIAL cycle) to match the Stripe side; the free period is
 * enforced app-side via users.trialEndsAt. Returns the subscription id plus the
 * `approve` link the caller should redirect the user to.
 */
export async function createSubscription(
  userId: number,
  opts: { returnUrl: string; cancelUrl: string }
): Promise<{ id: string; approveUrl: string }> {
  if (!PLAN_ID) throw new Error("PAYPAL_PLAN_ID is not configured");

  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: PLAN_ID,
      custom_id: String(userId),
      application_context: {
        brand_name: "Kubi",
        user_action: "SUBSCRIBE_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: opts.returnUrl,
        cancel_url: opts.cancelUrl,
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PayPal createSubscription error (${res.status}): ${await res.text()}`);
  }

  const sub = (await res.json()) as PayPalSubscription;
  const approveUrl = sub.links?.find((l) => l.rel === "approve")?.href;
  if (!approveUrl) {
    throw new Error("PayPal createSubscription returned no approve link");
  }
  return { id: sub.id, approveUrl };
}

/** Fetch a subscription's current state (status, next billing time, custom_id). */
export async function getSubscription(id: string): Promise<PayPalSubscription> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/v1/billing/subscriptions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PayPal getSubscription error (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as PayPalSubscription;
}

/** Cancel an active subscription. PayPal then emits BILLING.SUBSCRIPTION.CANCELLED. */
export async function cancelSubscription(id: string, reason: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/v1/billing/subscriptions/${id}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
    cache: "no-store",
  });
  // 204 No Content on success; PayPal 422s if already cancelled — treat as ok.
  if (!res.ok && res.status !== 422) {
    throw new Error(`PayPal cancelSubscription error (${res.status}): ${await res.text()}`);
  }
}

/**
 * Verify a webhook event's authenticity by calling PayPal's verify endpoint
 * with the PAYPAL-* transmission headers and the raw event body. Returns true
 * only when verification_status === "SUCCESS".
 */
export async function verifyWebhookSignature(
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  if (!WEBHOOK_ID) throw new Error("PAYPAL_WEBHOOK_ID is not configured");

  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: WEBHOOK_ID,
      webhook_event: JSON.parse(rawBody),
    }),
    cache: "no-store",
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.verification_status === "SUCCESS";
}
