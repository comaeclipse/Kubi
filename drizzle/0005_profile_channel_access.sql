CREATE TABLE IF NOT EXISTS "profile_channels" (
  "profile_id" integer NOT NULL REFERENCES "profiles"("id") ON DELETE cascade,
  "channel_id" integer NOT NULL REFERENCES "channels"("id") ON DELETE cascade,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profile_channels_profile_id_channel_id_pk" PRIMARY KEY("profile_id", "channel_id")
);
--> statement-breakpoint
-- Preserve the existing household-wide behavior for profiles that already
-- exist. Profiles created after this migration start with no channel access
-- until a parent grants it explicitly.
INSERT INTO "profile_channels" ("profile_id", "channel_id")
SELECT "profiles"."id", "user_channels"."channel_id"
FROM "profiles"
INNER JOIN "user_channels" ON "user_channels"."user_id" = "profiles"."user_id"
ON CONFLICT DO NOTHING;
