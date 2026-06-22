# Plan: Add PayPal Subscriptions Alongside Stripe

## Context

Kubi (package `safe-vision`, Vercel project `safervision`) just shipped a Stripe
monthly subscription ($9.99/mo) with a 14-day free trial that gates the entire
app. We want to offer **PayPal as a second payment option** on the same paywall,
so a parent can subscribe with *either* Stripe or PayPal and get identical app
access.

The existing access model makes this clean: a single function
`computeHasAccess()` in `src/lib/auth.ts` grants access if the user is an
operator, is within their DB-set `trialEndsAt` window, **or** has
`subscriptionStatus` of `"active"`/`"trialing"`. The trial is enforced entirely
app-side (set at registration), independent of any payment provider. So PayPal
just needs to (a) create a recurring subscription and (b) write a **normalized**
status into the existing `subscriptionStatus` column. We add a provider
discriminator so the UI/management routes know which API to call.

Design principles:
- **Mirror the Stripe flow** (server-side redirect → provider-hosted approval →
  webhook writes status → success page polls `/api/auth/status`). No client-side
  PayPal JS SDK — redirect server-side, exactly like Stripe Checkout.
- **Reuse the provider-agnostic columns** (`subscriptionId`, `subscriptionStatus`,
  `currentPeriodEndsAt`). Add `billingProvider` discriminator following the
  established `source: text(...)` pattern on `channels`/`videos`.
- **Charge immediately on approval** (no PayPal TRIAL billing cycle) to match the
  Stripe side, which charges immediately and relies on app-level `trialEndsAt`
  for the free period. Keeps both providers consistent.
- **Raw REST via `fetch`** in `src/lib/paypal.ts`, matching the per-integration
  module style of `src/lib/bunny.ts` (server-only, module-const secrets,
  `if (!res.ok) throw`). No PayPal Node SDK (the v1 subscriptions SDK is
  deprecated/unmaintained).

## Prerequisite (manual, one-time) — user does not yet have PayPal creds

1. At https://developer.paypal.com → Apps & Credentials → **Sandbox** → create a
   REST app. Capture **Client ID** and **Secret**.
2. Provide those two values. Implementation will then programmatically create the
   catalog product + billing plan (see step 5) and register the webhook, the same
   way the Stripe product/price/webhook were created in-session.

## Environment variables (add to `.env`, `.env.example`, and Vercel prod)

| Var | Purpose |
|-----|---------|
| `PAYPAL_CLIENT_ID` | OAuth2 basic-auth username |
| `PAYPAL_CLIENT_SECRET` | OAuth2 basic-auth password |
| `PAYPAL_PLAN_ID` | Billing plan id (`P-...`), created in step 5 |
| `PAYPAL_WEBHOOK_ID` | Registered webhook id, for signature verification |
| `PAYPAL_API_BASE` | `https://api-m.sandbox.paypal.com` (sandbox) / `https://api-m.paypal.com` (live) |

> **Important:** when adding to Vercel, add via Git Bash `printf '%s' '<value>' | vercel env add NAME production` — *not* PowerShell pipes, which appended a stray `\r` and broke the Stripe `Authorization` header earlier this session.

Reuse existing `NEXT_PUBLIC_APP_URL` for return/cancel URLs.

## Database change

`src/db/schema.ts` — add one column to the `users` table (all subscription cols
stay nullable):

```ts
// 'stripe' | 'paypal' — which provider owns the active subscription. Null until subscribed.
billingProvider: text("billing_provider"),
```

- `subscriptionId` now holds either a Stripe `sub_...` or a PayPal `I-...` id.
- `subscriptionStatus` continues to hold a **normalized lowercase** status
  (`active` | `trialing` | `past_due` | `canceled` | `incomplete`). PayPal webhook
  maps `ACTIVE→active`, `SUSPENDED→past_due`, `CANCELLED→canceled`,
  `EXPIRED→canceled`, `APPROVAL_PENDING→incomplete`. This keeps
  `computeHasAccess()` **unchanged**.
- `stripeCustomerId` stays Stripe-only (PayPal needs no equivalent stored object).

Apply with `drizzle-kit push`, then `ALTER TABLE users ADD COLUMN IF NOT EXISTS
billing_provider TEXT;` directly against **both** the `main` (prod) and
`dev-user-accounts` Neon branches (project `round-sky-95003157`) — the DB has no
migration journal, same as the Stripe column rollout. Existing Stripe subscribers
should be backfilled: `UPDATE users SET billing_provider='stripe' WHERE
subscription_id IS NOT NULL AND billing_provider IS NULL;`

## New files

### `src/lib/paypal.ts` (server-only REST client)
Pure functions mirroring `bunny.ts` conventions:
- `getAccessToken()` — `POST {BASE}/v1/oauth2/token`, Basic auth (client id/secret),
  body `grant_type=client_credentials`. Returns bearer token. (No caching needed
  initially; can add in-memory TTL cache later.)
- `createSubscription(userId, { returnUrl, cancelUrl })` — `POST
  {BASE}/v1/billing/subscriptions` with `{ plan_id: PAYPAL_PLAN_ID, custom_id:
  String(userId), application_context: { brand_name:"Kubi", user_action:
  "SUBSCRIBE_NOW", return_url, cancel_url } }`. Returns `{ id, approveUrl }`
  (approveUrl = the `rel:"approve"` link).
- `getSubscription(id)` — `GET {BASE}/v1/billing/subscriptions/{id}`. Returns
  status + `billing_info.next_billing_time` + `custom_id`.
- `cancelSubscription(id, reason)` — `POST {BASE}/v1/billing/subscriptions/{id}/cancel`.
- `verifyWebhookSignature(headers, rawBody)` — `POST
  {BASE}/v1/notifications/verify-webhook-signature` with `auth_algo`, `cert_url`,
  `transmission_id`, `transmission_sig`, `transmission_time` (from `PAYPAL-*`
  headers), `webhook_id: PAYPAL_WEBHOOK_ID`, `webhook_event: JSON.parse(rawBody)`.
  Returns `verification_status === "SUCCESS"`.
- `normalizePayPalStatus(s)` — maps the PayPal status enum to the internal status
  strings above.

### `src/app/api/paypal/subscribe/route.ts` (POST)
Mirror of the Stripe `checkout` route: auth via `getCurrentUser()` (login +
`emailVerified` only — **not** `hasAccess`-gated, so trial-expired users can buy).
Call `createSubscription(user.id, { returnUrl: ${appUrl}/subscribe/success,
cancelUrl: ${appUrl}/subscribe })`. Persist `billingProvider:'paypal'` and
`subscriptionId` immediately (status stays null/incomplete until webhook). Return
`{ url: approveUrl }`.

### `src/app/api/paypal/webhook/route.ts` (POST)
- Read `request.text()` raw body, verify via `verifyWebhookSignature()` (400 on
  failure). Look up the user by `subscriptionId = resource.id` (and/or
  `custom_id` for the activation event).
- Handle events → write normalized `subscriptionStatus` + `currentPeriodEndsAt`
  (from `billing_info.next_billing_time`):
  - `BILLING.SUBSCRIPTION.ACTIVATED` → `active`
  - `BILLING.SUBSCRIPTION.UPDATED` → re-fetch + normalize
  - `BILLING.SUBSCRIPTION.SUSPENDED` → `past_due`
  - `BILLING.SUBSCRIPTION.CANCELLED` / `.EXPIRED` → `canceled`
  - `PAYMENT.SALE.COMPLETED` (renewals) → refresh `currentPeriodEndsAt`
- Return `{ received: true }`; 500 on handler error (PayPal retries).

### `src/app/api/paypal/cancel/route.ts` (POST)
Auth via `getCurrentUser()`; 400 unless `billingProvider==='paypal'` and a
`subscriptionId` exists. Call `cancelSubscription(subscriptionId, "Cancelled from
Kubi")`. Optimistically set `subscriptionStatus:'canceled'` (webhook will confirm).
Return `{ ok: true }`.

> Note: the existing Stripe success page (`/subscribe/success`) already polls
> `/api/auth/status` until `hasAccess && subscriptionId` — provider-agnostic, so
> PayPal's `return_url` reuses it as-is. **Optional robustness add:** a
> `GET/POST /api/paypal/confirm?subscription_id=` that the success page can call
> once on PayPal return to fetch+write status immediately (covers sandbox webhook
> lag). Recommended but not required.

## Edited files

### `src/lib/auth.ts`
- Add `billingProvider: string | null` to `CurrentUser` and select it in
  `getCurrentUser()`. `computeHasAccess()` stays **unchanged** (still keys off
  normalized `subscriptionStatus`).

### `src/context/auth-context.tsx`
- Add `billingProvider: string | null` to the client `AuthUser` type.

### `src/app/(billing)/subscribe/page.tsx`
- Add a second CTA "Pay with PayPal" beneath the Stripe button. Its handler POSTs
  `/api/paypal/subscribe` and `window.location.href = data.url`. Keep the single
  pricing card; the two buttons share it. (PayPal-branded button styling, e.g.
  yellow.)

### `src/components/layout/header.tsx`
- The "Manage billing" menu item currently always opens the Stripe portal. Branch
  on `user.billingProvider`:
  - `'stripe'` → existing `handleManageBilling()` (Stripe portal).
  - `'paypal'` → new `handleCancelPayPal()` → confirm dialog → POST
    `/api/paypal/cancel` → `refresh()`; plus a "Manage on PayPal.com" external link
    (per chosen option: in-app cancel **+** PayPal link).
- `isOnTrial`/trial-countdown logic is unchanged (keys off `subscriptionId`, which
  PayPal also populates).

### `src/app/components/layout/app-shell.tsx`
- No change needed: `BARE_PREFIXES` already includes `/subscribe` (covers
  `/subscribe/success`), and the no-access redirect keys off `hasAccess`.

## Implementation order

1. Create PayPal sandbox app (user) → obtain client id/secret.
2. `src/lib/paypal.ts` REST client.
3. One-time setup script (Node, like the in-session Stripe creation): create
   catalog product → create billing plan ($9.99 USD/month, REGULAR cycle only) →
   register webhook (`https://safervision.vercel.app/api/paypal/webhook`,
   subscribe to the `BILLING.SUBSCRIPTION.*` + `PAYMENT.SALE.COMPLETED` events).
   Capture `PAYPAL_PLAN_ID` and `PAYPAL_WEBHOOK_ID`.
4. Env vars → `.env`, `.env.example`, Vercel prod (Git Bash `printf`).
5. Schema column + push + ALTER on both Neon branches + backfill existing Stripe rows.
6. API routes: `subscribe`, `webhook`, `cancel` (+ optional `confirm`).
7. Wire `auth.ts`, `auth-context.tsx`, subscribe page, header.
8. `npx tsc --noEmit`, commit on a feature branch, PR, deploy.

## Verification (end-to-end, sandbox)

1. `npx tsc --noEmit` clean.
2. Register a fresh account → confirm `trialEndsAt` set, app accessible.
3. Expire the trial via SQL (`UPDATE users SET trial_ends_at = NOW() - INTERVAL '1
   day' WHERE ...`) → reload → bounced to `/subscribe`.
4. Click **Pay with PayPal** → redirected to PayPal sandbox approval → approve with
   a sandbox personal account → redirected to `/subscribe/success`.
5. Confirm webhook `BILLING.SUBSCRIPTION.ACTIVATED` fires (PayPal dashboard webhook
   events / Vercel runtime logs) → DB shows `billing_provider='paypal'`,
   `subscription_status='active'` → success page polls `hasAccess` true → redirect
   home.
6. Header → "Manage billing" shows PayPal cancel + PayPal.com link. Click cancel →
   `/api/paypal/cancel` → `BILLING.SUBSCRIPTION.CANCELLED` webhook → status
   `canceled` → after trial window, access revoked (back to `/subscribe`).
7. Regression: Stripe checkout still works and Stripe users still get the Stripe
   portal (branch on `billingProvider`).

## Open considerations / risks

- **Webhook mapping when `subscription_id` not yet persisted:** the activation
  webhook may arrive before/after our `subscribe` route persists `subscriptionId`.
  Mitigate by writing `subscriptionId` synchronously in the `subscribe` route
  (before redirect) **and** falling back to `custom_id` (the user id) for lookup in
  the webhook handler.
- **PayPal sandbox webhook latency** can exceed the success page's 15s poll
  window; the optional `/api/paypal/confirm`-on-return endpoint removes that
  dependency.
- **Access token caching:** start without caching (one token fetch per request is
  fine at this scale); add a short in-memory TTL cache if call volume grows.
- **Local webhook testing:** PayPal has no `stripe listen` equivalent; use the
  PayPal Developer dashboard webhook simulator, or point the sandbox webhook at the
  deployed Vercel URL and test against production-sandbox directly (consistent with
  the "test on the website" approach used for Stripe).
