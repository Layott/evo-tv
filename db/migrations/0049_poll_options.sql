-- Polls that can actually be run on air.
--
-- A poll had a question, options, a duration and nothing else: everyone with an
-- account could vote, everyone saw the running totals, and when it closed it
-- simply stopped. So it could not be used for the thing a live channel wants a
-- poll for, which is a moment: hold the result back, close it, put the winner on
-- screen, and let the room see itself decide.
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "who_can_vote" text NOT NULL DEFAULT 'signed_in';
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "show_results_live" boolean NOT NULL DEFAULT true;
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "show_winner_on_stream" boolean NOT NULL DEFAULT false;
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "allow_vote_change" boolean NOT NULL DEFAULT false;

-- Metrics ask when the votes came in, and that question was a sequential scan
-- over every vote ever cast. `poll_votes.created_at` already existed; nothing
-- indexed it.
CREATE INDEX IF NOT EXISTS "poll_votes_poll_idx" ON "poll_votes" ("poll_id", "created_at");
