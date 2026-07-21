ALTER TABLE "profile_channels" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
-- Backfill a stable per-profile order for rows that predate this column,
-- oldest approval first, so existing lists don't all collapse to one order.
WITH ranked AS (
  SELECT profile_id, channel_id,
         ROW_NUMBER() OVER (PARTITION BY profile_id ORDER BY created_at, channel_id) - 1 AS rn
  FROM "profile_channels"
)
UPDATE "profile_channels" pc
SET sort_order = ranked.rn
FROM ranked
WHERE pc.profile_id = ranked.profile_id AND pc.channel_id = ranked.channel_id;
