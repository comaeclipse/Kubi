# User-Owned Private YouTube Channels

## Context

Today all channels in Kubi are a single shared **master library**: operators add YouTube channels via `/admin` (the "Manage" page), and every parent account opts channels in/out through the `user_channels` join table. There is no concept of channel ownership — `channels` has no `userId`, and `GET /api/channels` returns every channel.

The owner wants vetted parents to add **their own** YouTube channels from their Manage page, reusing the existing ingest flow. **Critically, a user-added channel must be visible only to that user's account — never to the master library, operators, or other users** — because users could add content inappropriate for a shared library (true crime, etc.).

Decisions locked with the user:
- **Import full history** (loop all pages, same as the operator import flow).
- **Cap 25 private channels per user.**
- **A real YouTube channel exists once system-wide.** If a user tries to add a channel already in the master library (or already privately owned), block it with a friendly message ("already available — enable it in your channel list"). This keeps the existing global unique constraints intact and avoids the large refactor that per-user duplicate channels/videos would require (the watch route `/api/videos/[id]` and progress tracking key on a globally-unique `youtubeVideoId` — see `src/app/api/videos/[id]/route.ts:75`).

## Approach

Add a single nullable `ownerUserId` column to `channels` (NULL = master library, non-NULL = private to that user). Add a **visibility predicate** — `(channels.ownerUserId IS NULL OR channels.ownerUserId = auth.id)` — to every place channels are listed or enabled, so private channels never leak. Add user-facing ingest routes (`requireUser`, ownership-checked) that copy the operator ingest logic, and a Manage-page UI section for adding/listing/removing private channels.

### 1. Schema — `src/db/schema.ts`

Add to the `channels` table (lines 62-78):
```ts
// Null = master library (operator-curated, shared). Non-null = private channel
// owned by and visible to only this user. set-null keeps the channel row if the
// owner is ever deleted (cleanup handled separately).
ownerUserId: integer("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
```
Use `onDelete: "cascade"` so deleting a user removes their private channels (and their videos cascade from `channels`).

**Keep** the existing global `.unique()` on `channels.youtubeChannelId` (line 66) and `videos.youtubeVideoId` (line 105). These enforce the "one row per real channel/video system-wide" model. The add endpoint relies on catching their unique violations.

Apply with `npx drizzle-kit push` (per README). Adding a nullable column is non-destructive — existing channels get `owner_user_id = NULL` (master), so all current behavior is unchanged.

### 2. Shared ingest helper — `src/lib/channel-import.ts` (new)

Extract the per-page import logic currently inlined in `src/app/api/channels/[id]/import/route.ts` so both operator and user routes share it (avoids divergent copies):
```ts
// Fetches one page of uploads, runs shorts detection, bulk-inserts videos
// (onConflictDoNothing). Returns { imported, nextPageToken }.
export async function importVideoPage(channelId: number, uploadsPlaylistId: string, pageToken?: string)
```
Reuses `fetchVideoPage` + `fetchVideoDetails` from `src/lib/youtube.ts`. Refactor the existing operator import route to call it too (behavior-preserving).

### 3. User-facing API routes (`requireUser`, ownership-scoped)

New namespace to avoid weakening the operator routes. All guard with `requireUser()` (`src/lib/auth.ts`).

**`src/app/api/my-channels/route.ts`**
- `GET`: list the caller's private channels with a video count — `where eq(channels.ownerUserId, auth.id)`, video count via correlated subquery like `src/app/api/playlists/route.ts:17-67`.
- `POST` (body `{ input }`): 
  1. Enforce cap: `count(channels where ownerUserId = auth.id)` must be `< 25`, else 400.
  2. `parseChannelIdentifier(input)` → `fetchChannelInfo(channelId)` (`src/lib/youtube.ts`).
  3. **Pre-check existence:** `select ... where eq(channels.youtubeChannelId, info.channelId)`. If a row exists, return 409 with a friendly message — if it's master (`ownerUserId null`): "This channel is already available — enable it in your channel list." If owned by someone else: "This channel has already been added." (Do **not** use `onConflictDoUpdate` here — a plain insert; also catch the unique-violation as a backstop race guard.)
  4. Insert channel with `ownerUserId: auth.id` (+ title/thumbnail/uploadsPlaylistId).
  5. **Auto-enable** for the account: insert a `userChannels` row `{ userId: auth.id, channelId }` so it shows immediately for their kids.
  6. Return `{ channel, uploadsPlaylistId }`.

**`src/app/api/my-channels/[id]/import/route.ts`**
- `POST` (body `{ pageToken? }`): load channel by id, **verify `ownerUserId === auth.id`** (404 otherwise), then `importVideoPage(...)`. Client loops on `nextPageToken` until null (full history). Next-16 async params + `Number.isInteger` check.

**`src/app/api/my-channels/[id]/route.ts`**
- `DELETE`: verify `ownerUserId === auth.id`, then delete the channel (cascades videos + userChannels). 404 if not owned/found.

### 4. Close the leak points (visibility predicate everywhere)

Apply `(channels.ownerUserId IS NULL OR channels.ownerUserId = auth.id)` (call it `visibleChannel(auth)`):

| File | Fix |
|---|---|
| `src/app/api/channels/route.ts` GET (lines 24-27) | **Highest priority.** Add the predicate to the base `select().from(channels)`. Fixes both `?all=1` (toggle list / onboarding) and the kid-facing view so operators/other users never see private channels; the owner sees master + their own. |
| `src/app/api/channels/[id]/toggle/route.ts` POST | Existence check must include the predicate — prevents a user enabling another user's private channel by guessing its id. |
| `src/app/api/onboarding/complete/route.ts` | `inArray(channels.id, requestedIds)` validation must AND the predicate. |
| `src/app/api/videos/route.ts` GET | Operator `?all=1` branch must exclude private channels: add `eq(channels.ownerUserId,...)`/`isNull` so operator browse stays master-only; non-operator path is already enabledIds-scoped (safe once toggle is guarded), but add the predicate for defense-in-depth. |
| `src/app/api/videos/[id]/route.ts` GET | Add the predicate alongside `enabledFilter` on the main-video lookup (the `related`/same-channel query inherits authorization from the main video). |
| `src/app/api/videos/spotlight/route.ts` | Add the predicate (defense-in-depth; already enabledIds-scoped). |
| `src/app/api/music/queue/route.ts` | Add the predicate — this route is NOT enablement-scoped today. Private channels carry no labels so wouldn't match music anyway, but guard explicitly. |
| `src/app/api/cron/sync-channels/route.ts` (line 19) | `select().from(channels)` → add `isNull(channels.ownerUserId)` so cron syncs **master only** (private channels aren't auto-synced; owner re-adds/re-syncs manually). Avoids quota burn. |

`continue-watching`, `recently-watched`, and `playlists/[id]` are scoped by the caller's own `profileId`/`userId`, so private videos there belong to the owner — no cross-user leak; left as-is.

### 5. Manage-page UI — `src/components/channel/my-channel-manager.tsx` (new)

Model on `src/components/channel/add-channel-dialog.tsx` + `src/components/admin/channel-manager.tsx`:
- **Add**: single text input ("YouTube URL, @handle, or channel ID") → `POST /api/my-channels`, take `channel.id`, then `do/while` loop `POST /api/my-channels/[id]/import` on `pageToken` accumulating an imported count for progress (identical pattern to `AddChannelDialog`). Surface the 409 "already available" message via `toast`.
- **List**: card per owned channel (title, thumbnail, video count) with a **Remove** button (`confirm()` → `DELETE /api/my-channels/[id]` → refresh). Show "X / 25 channels" and disable Add at the cap.
- Section header + helper text: **"Your channels — visible only to your account."**

Wire into `src/app/admin/page.tsx` for **all** users (outside the `{isOperator && ...}` block), next to `<ChannelToggleList>` (line 235): add a `loadMyChannels` callback and render `<MyChannelManager>`.

## Files

| File | Change |
|---|---|
| `src/db/schema.ts` | add `channels.ownerUserId` nullable FK (cascade) |
| `src/lib/channel-import.ts` | **new** — shared `importVideoPage` helper |
| `src/app/api/my-channels/route.ts` | **new** — GET list (w/ counts), POST add (cap 25, existence pre-check, auto-enable) |
| `src/app/api/my-channels/[id]/import/route.ts` | **new** — owner-checked page import |
| `src/app/api/my-channels/[id]/route.ts` | **new** — owner-checked DELETE |
| `src/app/api/channels/[id]/import/route.ts` | refactor to use `importVideoPage` |
| `src/app/api/channels/route.ts` | visibility predicate on base query |
| `src/app/api/channels/[id]/toggle/route.ts` | predicate on existence check |
| `src/app/api/onboarding/complete/route.ts` | predicate on id validation |
| `src/app/api/videos/route.ts`, `videos/[id]/route.ts`, `videos/spotlight/route.ts`, `music/queue/route.ts` | predicate on channel-joined queries |
| `src/app/api/cron/sync-channels/route.ts` | `isNull(ownerUserId)` — master only |
| `src/components/channel/my-channel-manager.tsx` | **new** — add/list/remove UI |
| `src/app/admin/page.tsx` | render `<MyChannelManager>` for all users |

Reused: `parseChannelIdentifier`/`fetchChannelInfo`/`fetchVideoPage`/`fetchVideoDetails` (`src/lib/youtube.ts`), `requireUser` (`src/lib/auth.ts`), correlated-count subquery (`src/app/api/playlists/route.ts`), ingest UI pattern (`src/components/channel/add-channel-dialog.tsx`).

## Verification

1. `npx drizzle-kit push`; confirm `channels.owner_user_id` exists and existing channels are NULL (Neon MCP `describe_table_schema` / `run_sql`). Confirm the app still works for an operator (master library unchanged).
2. `npm run dev`. As **regular user A**, open Manage → "Your channels" → add a niche channel (one NOT in master). Watch the import progress complete; confirm it appears in the list with a video count and is auto-enabled in the kid-facing channel list and home grid.
3. Play a video from A's private channel via `/watch` — confirm it loads (lookup + enabledFilter resolve).
4. **Leak checks (the core requirement):**
   - As **operator**, open `/admin` master-library list and call `GET /api/channels?all=1` — A's private channel must **not** appear. Operator video browse (`?all=1`) must not return its videos.
   - As **user B**, `GET /api/channels?all=1` must not list A's channel; attempting `POST /api/channels/{A_channel_id}/toggle` must 404/fail (can't enable it).
   - `GET /api/music/queue` as B must not surface A's videos.
5. Try adding a channel that's already in master → expect 409 with "enable it in your channel list" message.
6. Add channels up to 25, confirm the 26th is rejected and the Add control is disabled.
7. Remove a private channel → it disappears from A's lists, its videos are gone, and the master library is unaffected. Re-run cron sync (`/api/cron/sync-channels`) and confirm it does not touch private channels.
8. Confirm an unauthenticated/`requireUser`-failing call to `/api/my-channels` is rejected.

## Out of scope (noted)
- Per-user duplicate copies of a master channel (would require dropping global uniques + reworking the watch/progress key model).
- Automatic ongoing sync of private channels (cron is master-only); owner re-imports manually if desired.
- No labels/taxonomy or music-mode participation for private channels (they stay out of master features by design).
