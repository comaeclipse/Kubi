CREATE TABLE "labels" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "labels_kind_check" CHECK ("kind" IN ('category', 'tag'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "labels_slug_unique" ON "labels" USING btree ("slug");
--> statement-breakpoint
CREATE TABLE "channel_labels" (
	"channel_id" integer NOT NULL,
	"label_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "channel_labels_channel_id_label_id_pk" PRIMARY KEY("channel_id","label_id")
);
--> statement-breakpoint
CREATE INDEX "channel_labels_label_id_idx" ON "channel_labels" USING btree ("label_id");
--> statement-breakpoint
CREATE TABLE "video_labels" (
	"video_id" integer NOT NULL,
	"label_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_labels_video_id_label_id_pk" PRIMARY KEY("video_id","label_id")
);
--> statement-breakpoint
CREATE INDEX "video_labels_label_id_idx" ON "video_labels" USING btree ("label_id");
--> statement-breakpoint
ALTER TABLE "channel_labels" ADD CONSTRAINT "channel_labels_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "channel_labels" ADD CONSTRAINT "channel_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "video_labels" ADD CONSTRAINT "video_labels_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "video_labels" ADD CONSTRAINT "video_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "labels" ("slug", "name", "kind")
VALUES ('music', 'Music', 'category')
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarded_at" timestamp with time zone;
