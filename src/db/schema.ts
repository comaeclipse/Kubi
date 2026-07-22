import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Registered accounts (parents). Personal fields are encrypted at rest:
// `email` holds AES-256-GCM ciphertext, `emailHash` is an HMAC blind index used
// for unique constraint + login lookup (you can't query on the ciphertext).
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  emailHash: text("email_hash").notNull().unique(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  // Operators curate the master channel library; regular parents only toggle.
  isOperator: boolean("is_operator").notNull().default(false),
  // Null until the parent completes the first-run channel picker. Used to show
  // the onboarding modal exactly once.
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Subscription
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionId: text("subscription_id"),
  // 'stripe' | 'paypal' — which provider owns the active subscription. Null until subscribed.
  billingProvider: text("billing_provider"),
  // Normalized subscription status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
  subscriptionStatus: text("subscription_status"),
  // Set to createdAt + 30 days on registration; access is granted while this is in the future.
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEndsAt: timestamp("current_period_ends_at", { withTimezone: true }),
  // Set when the account registered through an invite link; set-null on invite
  // delete keeps the account alive. Used for per-invite registration counts.
  invitedVia: integer("invited_via").references((): AnyPgColumn => invitations.id, {
    onDelete: "set null",
  }),
  // Operator-flagged demo accounts: hides the delete-account option in the UI
  // and blocks the DELETE /api/auth/account endpoint.
  isDemo: boolean("is_demo").notNull().default(false),
  // bcrypt hash of the parent's 4-digit PIN, which gates every parent-only
  // screen and write (profile management, the channel library, the account).
  // Null = not set yet; the parent is prompted to create one the next time
  // they open a gated screen. Never leaves the server — the API only ever
  // exposes the derived `hasPin` boolean.
  parentPinHash: text("parent_pin_hash"),
  // Throttling for PIN entry. A 4-digit PIN is only 10k combinations, so
  // consecutive failures lock entry for a few minutes; both reset on success.
  pinFailedAttempts: integer("pin_failed_attempts").notNull().default(0),
  pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
});

// Server-side sessions (revocable). The cookie stores the opaque `token`.
export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Email verification + password reset tokens (only the sha256 hash is stored).
export const emailTokens = pgTable("email_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "verify" | "reset"
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  // For YouTube channels this is the YT channel id; for Bunny channels it's a
  // generated routing slug (e.g. "bunny-<uuid>"). Always unique.
  youtubeChannelId: text("youtube_channel_id").notNull().unique(),
  title: text("title").notNull(),
  // Nullable: Bunny channels have no cover until one is picked from a video.
  thumbnailUrl: text("thumbnail_url"),
  // Nullable: only YouTube channels have an uploads playlist.
  uploadsPlaylistId: text("uploads_playlist_id"),
  source: text("source").notNull().default("youtube"),
  bunnyLibraryId: text("bunny_library_id"),
  bunnyCdnHostname: text("bunny_cdn_hostname"),
  // GUID of the video whose thumbnail is used as this channel's cover.
  bunnyCoverVideoId: text("bunny_cover_video_id"),
  // Null = master library (operator-curated, shared). Non-null = private channel
  // owned by and visible to only this user. Cascade keeps things tidy if the
  // owner is deleted (their videos cascade from channels in turn).
  ownerUserId: integer("owner_user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  // Resume point for back-catalogue import. Channels added via search only
  // pull their newest page up front (so they're usable in seconds); the sync
  // cron walks older pages from this token until it runs out, then nulls it.
  // Null therefore means "fully imported" OR "never needed backfilling".
  backfillPageToken: text("backfill_page_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Per-account selection of master-library channels. A row's presence means the
// channel is enabled for that account; toggling off deletes the row.
export const userChannels = pgTable(
  "user_channels",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.channelId] }),
  })
);

// Per-profile permissions within a parent's enabled channel library. A row is
// required before a child profile can browse or play videos from that channel.
// `userChannels` remains the account-wide parent library; this table narrows
// that library for each child.
export const profileChannels = pgTable(
  "profile_channels",
  {
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    // Position of this channel in the profile's own drag-to-reorder list.
    // Lower sorts first; new approvals pop to the front (below the current min).
    sortOrder: integer("sort_order").notNull().default(0),
    // True  = the whole channel, including uploads that arrive later.
    // False = only the videos listed in `profileVideos` for this profile —
    //         future uploads stay out until the parent picks them.
    allVideos: boolean("all_videos").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profileId, table.channelId] }),
  })
);

// Per-video approvals, used only for channels where `profileChannels.allVideos`
// is false. A row here grants nothing on its own: access is always
// "channel is approved AND (whole channel OR this video is picked)", so
// revoking a channel instantly closes off its videos even if these rows linger.
export const profileVideos = pgTable(
  "profile_videos",
  {
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profileId, table.videoId] }),
  })
);

export const videos = pgTable(
  "videos",
  {
    id: serial("id").primaryKey(),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    // For YouTube videos this is the YT video id; for Bunny videos it's the
    // Bunny video GUID. Always unique and used as the /watch/[videoId] route key.
    youtubeVideoId: text("youtube_video_id").notNull().unique(),
    // Keyed HMAC of youtubeVideoId (videoIdBlindIndex). 1:1 with youtubeVideoId;
    // video_progress stores only this hash, and joins to it instead of the
    // plaintext id so watch history is opaque to raw DB access.
    youtubeVideoIdHash: text("youtube_video_id_hash"),
    // Scrambled 11-char watch-URL id (YouTube videos only; null for Bunny, which
    // keeps its GUID). Keeps the real YouTube id out of the browser URL bar.
    publicId: text("public_id"),
    title: text("title").notNull(),
    // Nullable: Bunny thumbnails are derived/served via /api/bunny/thumbnail.
    thumbnailUrl: text("thumbnail_url"),
    publishedAt: text("published_at").notNull(),
    duration: text("duration"),
    hidden: boolean("hidden").notNull().default(false),
    isShort: boolean("is_short").notNull().default(false),
    source: text("source").notNull().default("youtube"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    videoIdHashUnique: uniqueIndex("videos_youtube_video_id_hash_unique").on(
      table.youtubeVideoIdHash
    ),
    publicIdUnique: uniqueIndex("videos_public_id_unique").on(table.publicId),
  })
);

export const labels = pgTable(
  "labels",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex("labels_slug_unique").on(table.slug),
    kindCheck: check(
      "labels_kind_check",
      sql`${table.kind} IN ('category', 'tag')`
    ),
  })
);

export const channelLabels = pgTable(
  "channel_labels",
  {
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    labelId: integer("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.channelId, table.labelId] }),
    labelIdx: index("channel_labels_label_id_idx").on(table.labelId),
  })
);

export const videoLabels = pgTable(
  "video_labels",
  {
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    labelId: integer("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.videoId, table.labelId] }),
    labelIdx: index("video_labels_label_id_idx").on(table.labelId),
  })
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Kid profiles. `name` is AES-256-GCM ciphertext at rest. Scoped to an account.
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  avatarColor: text("avatar_color").notNull(),
  // Lowercased words the parent has blocked for this child; any video whose
  // title contains one is filtered out of every profile-scoped query. Stored in
  // plaintext (unlike `name`) — it is parental configuration, not personal data
  // about the child, and every content route depends on reading it.
  blockedKeywords: text("blocked_keywords")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  // Minutes of in-app time allowed per local day. Null = no limit.
  dailyLimitMinutes: integer("daily_limit_minutes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// In-app time banked per profile per local calendar day, for `dailyLimitMinutes`.
// Rows are written by the client's heartbeat but the seconds are computed from
// server time, so the tally can't be inflated or reset from the browser.
export const profileUsage = pgTable(
  "profile_usage",
  {
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // The child's local calendar day as YYYY-MM-DD, resolved server-side from
    // the timezone the client reports.
    usageDate: text("usage_date").notNull(),
    secondsUsed: integer("seconds_used").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profileId, table.usageDate] }),
  })
);

export const playlists = pgTable("playlists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Nullable: null = account-wide playlist, set = owned by a specific kid.
  profileId: integer("profile_id").references(() => profiles.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playlistVideos = pgTable(
  "playlist_videos",
  {
    playlistId: integer("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.playlistId, table.videoId] }),
  })
);

export const videoProgress = pgTable(
  "video_progress",
  {
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // Keyed HMAC of the video id (videoIdBlindIndex), not the plaintext id, so
    // raw DB access can't reveal which videos a profile watched. Joins to
    // videos.youtubeVideoIdHash to recover the plaintext id for display.
    videoIdHash: text("video_id_hash").notNull(),
    progressSeconds: integer("progress_seconds").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profileId, table.videoIdHash] }),
  })
);

// Cache of YouTube channel-search results, keyed by the normalized query.
// search.list costs 100 quota units against a 10k/day budget — roughly 100
// searches a day for the whole platform — so a repeated phrase must never hit
// the API twice. Rows are served until `fetchedAt` ages past the TTL in
// lib/youtube-search.ts.
export const youtubeSearchCache = pgTable("youtube_search_cache", {
  // Lowercased, whitespace-collapsed query text.
  query: text("query").primaryKey(),
  // JSON array of { channelId, title, thumbnailUrl }.
  results: text("results").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Per-account tally of uncached YouTube searches per local day, so one
// household can't drain the shared daily quota for everyone else.
export const youtubeSearchUsage = pgTable(
  "youtube_search_usage",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // UTC calendar day as YYYY-MM-DD — the quota resets on Google's clock,
    // not the household's.
    usageDate: text("usage_date").notNull(),
    searchCount: integer("search_count").notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.usageDate] }),
  })
);

// Operator-created reusable invite links. A single code can be shared with
// multiple people; each registration through it is counted via users.invitedVia.
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  // Random, unguessable, URL-safe token shared in the link. Stored in
  // plaintext (not hashed) — the only privilege it grants is auto-verified
  // registration, and registration is already open.
  code: text("code").notNull().unique(),
  label: text("label"),
  createdBy: integer("created_by").references((): AnyPgColumn => users.id, {
    onDelete: "set null",
  }),
  // Null = unlimited uses / never expires.
  maxUses: integer("max_uses"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
