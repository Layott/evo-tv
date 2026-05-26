ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "scheduled_start_at" text;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "scheduled_duration_min" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "streams_scheduled_idx" ON "streams" USING btree ("scheduled_start_at");
