CREATE TABLE IF NOT EXISTS "app_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"version" text NOT NULL,
	"build_number" integer NOT NULL,
	"commit_sha" text NOT NULL,
	"file_url" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"notes" text,
	"released_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_releases_platform_build_idx" ON "app_releases" USING btree ("platform","build_number");
