ALTER TABLE "waitlist" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "verify_token" text;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "verified_at" text;
