ALTER TABLE "profile_channels" ADD COLUMN IF NOT EXISTS "all_videos" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_videos" (
	"profile_id" integer NOT NULL,
	"video_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_videos_profile_id_video_id_pk" PRIMARY KEY("profile_id","video_id")
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_videos" ADD CONSTRAINT "profile_videos_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_videos" ADD CONSTRAINT "profile_videos_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
