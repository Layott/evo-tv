ALTER TABLE "channels" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "suspended_reason" text;
