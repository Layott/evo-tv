ALTER TABLE "streams" ADD COLUMN "maturity_rating" text DEFAULT 'teen' NOT NULL;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN "content_tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "vods" ADD COLUMN "maturity_rating" text DEFAULT 'teen' NOT NULL;--> statement-breakpoint
ALTER TABLE "vods" ADD COLUMN "content_tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "maturity_rating" text DEFAULT 'teen' NOT NULL;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "content_tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "maturity_rating" text DEFAULT 'teen' NOT NULL;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "content_tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "maturity_rating" text DEFAULT 'teen' NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "content_tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_prefs" ADD COLUMN "maturity_preference" text DEFAULT 'mature' NOT NULL;
