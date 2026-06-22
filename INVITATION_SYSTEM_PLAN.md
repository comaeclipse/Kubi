# Invitation System (Admin-Controlled)

## Context

Kubi (internally `safe-vision`) has open, custom-built email/password registration: new users are created with `email_verified = false` and must click a Resend verification link before they can log in (`src/app/api/auth/register/route.ts`, enforced in `login` and `requireUser`). The owner wants to personally vet who joins and remove friction for those people. The goal: an **operator-only** invitation manager on the existing `/admin` page where the owner can **create reusable invite links, see how many people registered against each, and delete invites** — and when someone registers through an invite link their **email is auto-verified**, skipping the email round-trip.

Decisions locked with the user:
- **Reusable links** (one invite link, many signups) with a per-invite registration count. Optional max-uses / expiry.
- **Keep registration as email + password** (no username field is added — current schema has none).
- **Copy-a-link delivery**: admin UI generates a link the owner copies and shares manually. No invite emails are sent.
- Open registration still works; an invite link only *adds* auto-verification. (A future "invite-only" toggle is noted as out of scope.)

## Approach

Add an `invitations` table, an operator-guarded CRUD API, an admin manager component, and a small change to the registration route + register page so an `invite` code carried in the URL auto-verifies the new account and links it to the invite for counting.

### 1. Schema — `src/db/schema.ts`

Add an `invitations` table (follow existing `pgTable` conventions) and one nullable column on `users`.

```ts
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  // Random, unguessable, URL-safe token shared in the link. Stored in
  // plaintext (not hashed) so the admin can re-copy the link later — the only
  // privilege it grants is "register with email auto-verified", and
  // registration is already open, so this is a low-sensitivity bearer token.
  code: text("code").notNull().unique(),
  // Optional human note so the owner remembers who/what the invite is for.
  label: text("label"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  // Null = unlimited uses / never expires.
  maxUses: integer("max_uses"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Add to `users`:
```ts
// Set when the account registered through an invite link; used for the
// per-invite registration count. set-null on invite delete keeps the account.
invitedVia: integer("invited_via").references(() => invitations.id, { onDelete: "set null" }),
```

Apply with `npx drizzle-kit push` (per README; there is no `db:*` script). Adding a nullable column + new table is non-destructive, so `push` is safe — no hand-written migration like `scripts/migrate-accounts.mjs` is needed.

### 2. Invite validation helper — `src/lib/invites.ts` (new)

A small shared module so both the register route and (optionally) the register page can validate a code:

```ts
// Returns the invite row if code is valid AND not expired AND under maxUses,
// else null. Uses generateToken() from src/lib/crypto.ts to mint codes.
export async function findUsableInvite(code: string): Promise<Invitation | null>
export function newInviteCode(): string // generateToken(16) -> base64url
```

`findUsableInvite` checks `expiresAt > now` (when set) and compares `maxUses` (when set) against the current registration count (`select count(*) from users where invited_via = invite.id`). Reuse `db`, `eq`, `sql` exactly as in `src/app/api/playlists/route.ts`.

### 3. API routes (operator-guarded)

Mirror the canonical handler shape and the `src/app/api/labels/` collection+item layout. Guard every handler with `requireOperator()` (`src/lib/auth.ts`) — the return-a-`NextResponse`-or-user pattern.

**`src/app/api/admin/invites/route.ts`**
- `GET`: list all invites, newest first, each with `registrations` computed via a correlated subquery counting `users.invitedVia` — copy the `videoCountSq` pattern from `src/app/api/playlists/route.ts:17-67`. Return `id, code, label, maxUses, expiresAt, createdAt, registrations`.
- `POST`: body `{ label?, maxUses?, expiresAt? }`; generate `code = newInviteCode()`; `insert(...).returning()`; map unique-violation to a friendly error like `labels/route.ts:48-53`; return 201.

**`src/app/api/admin/invites/[id]/route.ts`**
- `DELETE`: Next-16 async params (`params: Promise<{ id: string }>`, `Number.isInteger` check); `delete(...).where(eq(invitations.id, id)).returning({ id })`; 404 if nothing deleted. (FK `set null` means linked accounts survive; their count simply disappears with the invite.)

### 4. Registration changes — `src/app/api/auth/register/route.ts`

Accept an optional `invite` code in the body. After the existing email/password validation and the existing-user check, resolve the invite:

```ts
const invite = typeof invite === "string" && invite ? await findUsableInvite(invite) : null;
```

In the `db.insert(users).values({...})`:
- add `emailVerified: invite ? true : false`
- add `invitedVia: invite ? invite.id : null`

Then **only when there is no invite** issue the verify token + send the email (lines 50-51). Invited users skip both and are immediately able to log in. Keep the generic `{ success: true }` response shape unchanged (no enumeration leak). An invalid/expired/maxed invite is treated as "no invite" (falls back to normal verification) rather than erroring — simplest and safe.

### 5. Register page — `src/app/(auth)/register/page.tsx`

- Read the code from the URL with `useSearchParams().get("invite")` and include it in the POST body. `useSearchParams` requires a `<Suspense>` boundary in Next 16 — wrap the form body in `<Suspense>` (or split into a child component) to keep the build clean.
- When an invite code is present, change the success copy: instead of "Check your email", show "Account created — you can log in now" with the Go-to-login button (invited accounts are pre-verified). Optionally show a small "You've been invited" banner.

### 6. Admin UI — `src/components/admin/invite-manager.tsx` (new)

Model on `src/components/admin/taxonomy-manager.tsx` (create form + list of `Card`s, `sonner` toasts, `confirm()` delete). Props `{ invites, onRefresh }`; parent owns fetch/state.
- **Create**: inline form — `Input` for label, optional `Input type=number` for max uses, optional date for expiry — POSTs to `/api/admin/invites`, then `onRefresh()`.
- **List**: one `Card` per invite showing the label, a `Badge` with `registrations` count (e.g. "3 registered"), max-uses/expiry if set, a **Copy link** button (`Copy` icon → `navigator.clipboard.writeText(`${window.location.origin}/register?invite=${code}`)` + toast), and a `Trash2` delete button (`confirm()` → DELETE → `onRefresh()`).

Wire into `src/app/admin/page.tsx`: add a `loadInvites` callback mirroring `loadLabels`, fetch on mount, and render `<InviteManager .../>` **inside the existing `{isOperator && (...)}` block** alongside `<TaxonomyManager />`.

## Files

| File | Change |
|---|---|
| `src/db/schema.ts` | add `invitations` table + `users.invitedVia` column |
| `src/lib/invites.ts` | **new** — `findUsableInvite`, `newInviteCode` |
| `src/app/api/admin/invites/route.ts` | **new** — GET list w/ counts, POST create |
| `src/app/api/admin/invites/[id]/route.ts` | **new** — DELETE |
| `src/app/api/auth/register/route.ts` | accept `invite`; auto-verify + link; skip email when invited |
| `src/app/(auth)/register/page.tsx` | read `?invite=`, pass through, adjust success copy (Suspense) |
| `src/components/admin/invite-manager.tsx` | **new** — create/list/copy/delete UI |
| `src/app/admin/page.tsx` | `loadInvites` + render `<InviteManager>` in operator block |

Reused primitives: `requireOperator` (`src/lib/auth.ts`), `generateToken` (`src/lib/crypto.ts`), correlated-count subquery (`src/app/api/playlists/route.ts`), CRUD/unique-error patterns (`src/app/api/labels/*`), UI template (`src/components/admin/taxonomy-manager.tsx`).

## Verification

1. `npx drizzle-kit push` against `DATABASE_URL`; confirm `invitations` table + `users.invited_via` exist (Neon MCP `describe_table_schema` or `run_sql`).
2. `npm run dev`. As an operator, open `/admin` → create an invite with label "test", maxUses 2. Confirm it appears with "0 registered" and the Copy-link button yields `…/register?invite=<code>`.
3. Open the copied link in a private window, register a new email+password. Confirm: success screen says you can log in now (no email step), and you can log in immediately (no "verify your email" 403).
4. Verify in DB the new user has `email_verified = true` and `invited_via` = the invite id (Neon MCP `run_sql`). Reload `/admin`; the invite shows "1 registered".
5. Register a 3rd account against the same invite (now at max) → it falls back to normal verification (account created unverified, verify email logged to console since `RESEND_API_KEY` may be unset).
6. Register without any invite at `/register` → unchanged behavior: "Check your email", `email_verified = false`.
7. Delete the invite in `/admin`; confirm it disappears and the previously-invited accounts still exist and can still log in.
8. Confirm a non-operator hitting `/api/admin/invites` gets 403.
