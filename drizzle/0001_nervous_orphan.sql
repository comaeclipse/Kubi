ALTER TABLE "channels" ALTER COLUMN "thumbnail_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "uploads_playlist_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ALTER COLUMN "thumbnail_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "source" text DEFAULT 'youtube' NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "bunny_library_id" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "bunny_cdn_hostname" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "bunny_cover_video_id" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "source" text DEFAULT 'youtube' NOT NULL;