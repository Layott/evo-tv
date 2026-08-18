-- Live telemetry: the three cuts a live audience has and watch_events did not.
--
-- video_view_buckets has carried country and device for VOD since 0040. Live
-- had neither, so an operator could see how many were watching but never from
-- where or on what. rung is which quality the player actually pulled, which is
-- the number that says whether a 1080p rung would earn its bandwidth.
--
-- All nullable: every existing row predates the columns and is still valid.
ALTER TABLE "watch_events" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "watch_events" ADD COLUMN IF NOT EXISTS "device" text;
ALTER TABLE "watch_events" ADD COLUMN IF NOT EXISTS "rung" text;

-- Every control room query is scoped to one stream. The existing index is
-- scoped to a channel, which does not serve them.
CREATE INDEX IF NOT EXISTS "watch_events_stream_bucket_idx"
  ON "watch_events" ("stream_id", "minute_bucket");
