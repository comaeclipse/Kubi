import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

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

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  avatarColor: text("avatar_color").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playlists = pgTable("playlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
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
