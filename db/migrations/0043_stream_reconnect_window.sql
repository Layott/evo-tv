-- Let a broadcast survive losing its feed.
--
-- Today the first `on_publish_done` from nginx ends the stream outright, so a
-- dropped RTMP connection takes the channel off air even when the encoder comes
-- straight back. Worse, `on_publish` only fires on connect, so if the feed
-- returns on a connection that never dropped, nothing ever puts the stream back
-- and it stays dead until somebody notices. That is how EVO TV LIVE 24/7 was
-- marked ended at 01:11 while all three rungs were still publishing at 03:40.
--
-- YouTube's model instead: losing the feed starts a clock rather than ending
-- the broadcast. Reconnect inside the window and viewers keep their place; miss
-- it and the stream ends for real.
--
-- Three columns, one idea:
--
--   reconnect_window_sec  how long a feed may be gone before the broadcast is
--                         considered over. 0 ends it immediately, which is the
--                         old behaviour for anyone who wants it.
--   feed_lost_at          when the feed went, or NULL while it is healthy.
--                         Cleared on every publish.
--   offline_by_operator   somebody pressed "End broadcast". Ends now, and stops
--                         the reconciler bringing it back while the encoder is
--                         still pushing.
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "reconnect_window_sec" integer NOT NULL DEFAULT 300;
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "feed_lost_at" text;
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "offline_by_operator" boolean NOT NULL DEFAULT false;
