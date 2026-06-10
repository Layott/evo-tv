ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "playout_file_path" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playout_media" (
	"id" text PRIMARY KEY NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"duration_sec" integer,
	"size_mb" integer,
	"last_seen_at" text NOT NULL,
	"created_at" text NOT NULL,
	"deleted_at" text,
	CONSTRAINT "playout_media_file_path_unique" UNIQUE("file_path")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playout_media_active_idx" ON "playout_media" USING btree ("deleted_at");
