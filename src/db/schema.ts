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
  // Stripe subscription status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
  subscriptionStatus: text("subscription_status"),
  // Set to createdAt + 14 days on registration; access is granted while this is in the future.
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEndsAt: timestamp("current_period_ends_at", { withTimezone: true }),
  // Set when the account registered through an invite link; set-null on invite
  // delete keeps the account alive. Used for per-invite registration counts.
  invitedVia: integer("invited_via").references(() => invitations.id, {
    onDelete: "set null",
  }),
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

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  // For YouTube videos this is the YT video id; for Bunny videos it's the
  // Bunny video GUID. Always unique and used as the /watch/[videoId] route key.
  youtubeVideoId: text("youtube_video_id").notNull().unique(),
  title: text("title").notNull(),
  // Nullable: Bunny thumbnails are derived/served via /api/bunny/thumbnail.
  thumbnailUrl: text("thumbnail_url"),
  publishedAt: text("published_at").notNull(),
  duration: text("duration"),
  hidden: boolean("hidden").notNull().default(false),
  isShort: boolean("is_short").notNull().default(false),
  source: text("source").notNull().default("youtube"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
    youtubeVideoId: text("youtube_video_id").notNull(),
    progressSeconds: integer("progress_seconds").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profileId, table.youtubeVideoId] }),
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
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  // Null = unlimited uses / never expires.
  maxUses: integer("max_uses"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
