CREATE TABLE IF NOT EXISTS "youtube_search_cache" (
	"query" text PRIMARY KEY NOT NULL,
	"results" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "youtube_search_usage" (
	"user_id" integer NOT NULL,
	"usage_date" text NOT NULL,
	"search_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "youtube_search_usage_user_id_usage_date_pk" PRIMARY KEY("user_id","usage_date")
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "youtube_search_usage" ADD CONSTRAINT "youtube_search_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
