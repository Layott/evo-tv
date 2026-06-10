CREATE TABLE IF NOT EXISTS "waitlist" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email"),
	CONSTRAINT "waitlist_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_created_idx" ON "waitlist" USING btree ("created_at");
