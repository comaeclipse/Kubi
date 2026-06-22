CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label" text,
	"created_by" integer,
	"max_uses" integer,
	"expires_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_status" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_period_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invited_via" integer;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_invited_via_invitations_id_fk" FOREIGN KEY ("invited_via") REFERENCES "public"."invitations"("id") ON DELETE set null ON UPDATE no action;