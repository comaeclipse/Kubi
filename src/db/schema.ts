import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
