-- Chat rules an operator can change, and the strikes that enforce them.
--
-- The chat had three banned words in a TODO comment in the route file and
-- nothing else, so "stop people posting links" meant a deploy. Links are the
-- actual problem on a live channel: scam drops, fake giveaways, other people's
-- streams.
--
-- `stream_id` NULL is the house rule; a row with a stream is that broadcast's
-- own, and it replaces the house rule rather than adding to it, because two
-- sets of rules that partly apply is the kind of thing nobody can reason about
-- at 9pm with chat moving.
CREATE TABLE IF NOT EXISTS "chat_rules" (
  "id" text PRIMARY KEY,
  "stream_id" text REFERENCES "streams"("id") ON DELETE CASCADE,
  "block_links" boolean NOT NULL DEFAULT true,
  "allowed_domains" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "banned_words" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "strikes_before_ban" integer NOT NULL DEFAULT 3,
  "ban_minutes" integer NOT NULL DEFAULT 60,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_rules_global_idx"
  ON "chat_rules" (("stream_id" IS NULL)) WHERE "stream_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "chat_rules_stream_idx"
  ON "chat_rules" ("stream_id") WHERE "stream_id" IS NOT NULL;

-- A strike is per person per broadcast. Somebody who pasted a link in one match
-- three weeks ago is not two thirds of the way to a ban tonight.
CREATE TABLE IF NOT EXISTS "chat_strikes" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "stream_id" text NOT NULL REFERENCES "streams"("id") ON DELETE CASCADE,
  "count" integer NOT NULL DEFAULT 0,
  "last_at" text NOT NULL,
  PRIMARY KEY ("user_id", "stream_id")
);

-- A ban the rules issued has no person behind it, and attributing it to the
-- offender (the only way to satisfy a NOT NULL here) would put a lie in the
-- moderation list: it would read as though they banned themselves.
ALTER TABLE "user_sanctions" ALTER COLUMN "issued_by" DROP NOT NULL;
