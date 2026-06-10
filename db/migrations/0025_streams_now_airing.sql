ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "now_airing_title" text;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "now_airing_subtitle" text;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "now_airing_target_id" text;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "now_airing_thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "now_airing_started_at" text;
