-- The flagship channel: the one broadcast that owns the top of the site.
--
-- EVO TV is a channel first and a catalogue second, so one stream has to be
-- the one people land on. Doing that by convention, an id like `channel_main`
-- or "whatever is live and featured", breaks the moment a second stream is
-- featured or somebody renames a row.
--
-- The partial unique index is the point: it is enforced by the database that
-- at most one stream is the main channel, so the home page can select it
-- without a tiebreak and without ever rendering two heroes.
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "is_main_channel" boolean NOT NULL DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "streams_main_channel_idx" ON "streams" ("is_main_channel") WHERE "is_main_channel";--> statement-breakpoint
-- Shown when the channel is off air. `thumbnail_url` is the small card image;
-- this is the full-bleed one behind the player, which wants different framing.
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "poster_url" text NOT NULL DEFAULT '';--> statement-breakpoint
-- One line under the title on the hero. Empty means show nothing rather than
-- inventing a strapline.
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "tagline" text NOT NULL DEFAULT '';
