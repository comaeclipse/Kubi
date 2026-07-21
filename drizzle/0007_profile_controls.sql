ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "blocked_keywords" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "daily_limit_minutes" integer;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_usage" (
	"profile_id" integer NOT NULL,
	"usage_date" text NOT NULL,
	"seconds_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_usage_profile_id_usage_date_pk" PRIMARY KEY("profile_id","usage_date")
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_usage" ADD CONSTRAINT "profile_usage_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
