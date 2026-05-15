ALTER TABLE "streams" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "vods" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "deleted_at" text;
