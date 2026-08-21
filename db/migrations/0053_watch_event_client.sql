-- What the viewer was actually watching on.
--
-- `watch_events` recorded a coarse device word derived from the user agent, a
-- country from a Cloudflare header, and a rung nothing ever reported. That was
-- enough to say "somebody on a desktop in Nigeria" and nothing else, and the
-- app told us the least of all: a React Native user agent parses as neither a
-- phone nor a browser, so the audience breakdown filed every app viewer under
-- Unknown while the app is the surface most people watch on.
--
-- The app knows exactly what it is running on. These columns are where it says
-- so, and the website fills the same ones from its user agent, so one breakdown
-- answers for both.
--
-- All nullable: every row written before this knows none of it, and a viewer on
-- an old build will keep not reporting some of it for as long as that build
-- lives on their phone.
ALTER TABLE "watch_events" ADD COLUMN IF NOT EXISTS "platform" text;
ALTER TABLE "watch_events" ADD COLUMN IF NOT EXISTS "model" text;
ALTER TABLE "watch_events" ADD COLUMN IF NOT EXISTS "os_name" text;
ALTER TABLE "watch_events" ADD COLUMN IF NOT EXISTS "os_version" text;
ALTER TABLE "watch_events" ADD COLUMN IF NOT EXISTS "app_version" text;

-- The breakdowns group by these over a date range, which is the only way they
-- are ever read.
CREATE INDEX IF NOT EXISTS "watch_events_platform_idx"
  ON "watch_events" ("platform", "created_at");
