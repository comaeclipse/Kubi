// One-time PayPal setup: provisions the catalog product, the $2.99/mo billing
// plan, and the webhook subscription, then prints the PAYPAL_PLAN_ID and
// PAYPAL_WEBHOOK_ID to add to your env (.env, .env.example, Vercel prod).
//
// Idempotency: PayPal has no upsert for these. The script is safe to re-run but
// will create NEW product/plan/webhook objects each time — run it once, capture
// the ids, and don't re-run unless you intend to replace them. (A duplicate
// webhook for the same URL will 400 with WEBHOOK_URL_ALREADY_EXISTS, which the
// script reports rather than crashing.)
//
// The plan has a single REGULAR pricing cycle (no TRIAL) so PayPal charges
// immediately on approval — the 30-day free period is enforced app-side via
// users.trialEndsAt, exactly like the Stripe side.
//
// Required env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
// Optional env: PAYPAL_API_BASE (default sandbox), WEBHOOK_URL
//   (default https://safervision.vercel.app/api/paypal/webhook)
//
// Run: node scripts/paypal-setup.mjs

const {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com",
  WEBHOOK_URL = "https://safervision.vercel.app/api/paypal/webhook",
} = process.env;

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required");
}

const BASE = PAYPAL_API_BASE;

async function token() {
  const basic = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`token (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

async function api(method, path, accessToken, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  const accessToken = await token();

  // 1. Catalog product.
  const product = await api("POST", "/v1/catalogs/products", accessToken, {
    name: "Kubi Subscription",
    description: "Kubi monthly subscription",
    type: "SERVICE",
    category: "SOFTWARE",
  });
  if (!product.ok) throw new Error(`product (${product.status}): ${JSON.stringify(product.json)}`);
  console.log("product id:", product.json.id);

  // 2. Billing plan — $2.99 USD / month, single REGULAR cycle (no trial).
  const plan = await api("POST", "/v1/billing/plans", accessToken, {
    product_id: product.json.id,
    name: "Kubi Monthly",
    description: "Kubi monthly subscription ($2.99/mo)",
    status: "ACTIVE",
    billing_cycles: [
      {
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0, // 0 = infinite
        pricing_scheme: {
          fixed_price: { value: "2.99", currency_code: "USD" },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: "CONTINUE",
      payment_failure_threshold: 3,
    },
  });
  if (!plan.ok) throw new Error(`plan (${plan.status}): ${JSON.stringify(plan.json)}`);
  console.log("PAYPAL_PLAN_ID:", plan.json.id);

  // 3. Webhook.
  const webhook = await api("POST", "/v1/notifications/webhooks", accessToken, {
    url: WEBHOOK_URL,
    event_types: [
      { name: "BILLING.SUBSCRIPTION.ACTIVATED" },
      { name: "BILLING.SUBSCRIPTION.UPDATED" },
      { name: "BILLING.SUBSCRIPTION.SUSPENDED" },
      { name: "BILLING.SUBSCRIPTION.CANCELLED" },
      { name: "BILLING.SUBSCRIPTION.EXPIRED" },
      { name: "PAYMENT.SALE.COMPLETED" },
    ],
  });
  if (webhook.ok) {
    console.log("PAYPAL_WEBHOOK_ID:", webhook.json.id);
  } else if (JSON.stringify(webhook.json).includes("WEBHOOK_URL_ALREADY_EXISTS")) {
    const existing = await api("GET", "/v1/notifications/webhooks", accessToken);
    const match = existing.json.webhooks?.find((w) => w.url === WEBHOOK_URL);
    console.log("PAYPAL_WEBHOOK_ID (existing):", match?.id ?? "(unknown — list manually)");
  } else {
    throw new Error(`webhook (${webhook.status}): ${JSON.stringify(webhook.json)}`);
  }

  console.log("\nDone. Add PAYPAL_PLAN_ID and PAYPAL_WEBHOOK_ID to .env + Vercel prod.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
