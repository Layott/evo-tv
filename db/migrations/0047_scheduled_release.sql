-- A video can be given a date, and stay off the site until it arrives.
--
-- `published_at` looked like this and was not: nothing filtered on it, it only
-- ever sorted, so a row dated next Friday was on the site today and played
-- today. Episodes had `premiere_at`, read by nothing at all.
--
-- Null means published. Every existing row is therefore exactly as it was, and
-- "scheduled" is a thing an editor opts into rather than a state the table
-- acquired overnight.
ALTER TABLE "vods" ADD COLUMN IF NOT EXISTS "publish_at" text;

-- The list queries filter on it, so it needs to be cheap to ask.
CREATE INDEX IF NOT EXISTS "vods_publish_at_idx" ON "vods" ("publish_at");
CREATE INDEX IF NOT EXISTS "episodes_premiere_idx" ON "episodes" ("premiere_at");
