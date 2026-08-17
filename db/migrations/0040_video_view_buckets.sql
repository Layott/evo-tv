-- Per-video playback analytics.
--
-- Nothing recorded how far into a video anyone got. `episode_progress` and
-- `vod_progress` keep one row per viewer holding the latest position, which is
-- what a resume button needs and useless for analytics: it cannot say how many
-- people dropped out in the first thirty seconds, only where the survivors
-- stopped. `watch_events` is minute buckets against a live channel, not a title.
--
-- So this records position, and the shape is chosen to stay bounded. One row
-- per (video, session, percent-of-duration) means a viewer can generate at most
-- 100 rows for a video no matter how long they watch or how often the player
-- beats, and re-watching the same part costs nothing because the primary key
-- collides and the insert is dropped.
--
-- Everything the admin page shows falls out of this one table:
--   views              = count(distinct session_id)
--   watch time         = count(*) * duration_sec / 100
--   average % viewed   = avg over sessions of (max(bucket) + 1)
--   audience retention = per bucket, sessions reaching it / total sessions
CREATE TABLE IF NOT EXISTS "video_view_buckets" (
	"video_type" text NOT NULL,
	"video_id" text NOT NULL,
	"session_id" text NOT NULL,
	"bucket" integer NOT NULL,
	"user_id" text,
	"country" text DEFAULT '' NOT NULL,
	"device" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_view_buckets_pk" PRIMARY KEY("video_type","video_id","session_id","bucket")
);--> statement-breakpoint

-- `set null` rather than cascade: deleting an account must not silently revise
-- the view counts of every video they ever watched.
DO $$ BEGIN
	ALTER TABLE "video_view_buckets"
		ADD CONSTRAINT "video_view_buckets_user_id_user_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "user"("id")
		ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- The page always asks "this video, this date range".
CREATE INDEX IF NOT EXISTS "video_view_buckets_video_idx"
	ON "video_view_buckets" USING btree ("video_type","video_id","created_at");--> statement-breakpoint

-- Used by the catalogue ranking, which asks across all videos in a range.
CREATE INDEX IF NOT EXISTS "video_view_buckets_created_idx"
	ON "video_view_buckets" USING btree ("created_at");--> statement-breakpoint

-- GDPR purge deletes by user.
CREATE INDEX IF NOT EXISTS "video_view_buckets_user_idx"
	ON "video_view_buckets" USING btree ("user_id");
