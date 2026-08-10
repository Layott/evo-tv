CREATE TABLE IF NOT EXISTS "epg_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"duration_min" integer NOT NULL,
	"title" text NOT NULL,
	"pillar" text DEFAULT 'esports' NOT NULL,
	"parental_rating" integer,
	"genre_id" integer,
	"subgenre_id" integer,
	"slot_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "epg_slots_day_start_idx" ON "epg_slots" ("day_of_week","start_minute") WHERE "epg_slots"."is_active";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "epg_slots_day_idx" ON "epg_slots" ("day_of_week","start_minute");
