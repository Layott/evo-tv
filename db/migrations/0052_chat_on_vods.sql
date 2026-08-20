-- Chat under a VOD, and replies in both places.
--
-- Chat existed only on a live stream, so the moment a broadcast became a
-- recording every word said about it disappeared from the page. And a message
-- could not answer another message anywhere, live or recorded, which is what
-- turns a chat from a stream of remarks into a conversation.
--
-- One table on purpose rather than a second comments table: the moderation
-- queue, the chat rules, the bans and the SSE plumbing already exist here, and
-- a parallel implementation would need all four again and would drift.
ALTER TABLE "chat_messages" ALTER COLUMN "stream_id" DROP NOT NULL;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "vod_id" text
  REFERENCES "vods"("id") ON DELETE CASCADE;

-- A reply points at the message it answers. ON DELETE SET NULL, not CASCADE:
-- deleting a rule-breaking message must not silently delete the answers to it,
-- which are usually the people objecting to it.
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "parent_id" text
  REFERENCES "chat_messages"("id") ON DELETE SET NULL;

-- Exactly one target. A message belonging to both, or to neither, is a bug that
-- would otherwise be discovered by somebody reading an empty chat.
ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_target_chk";
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_target_chk"
  CHECK (("stream_id" IS NOT NULL) <> ("vod_id" IS NOT NULL));

CREATE INDEX IF NOT EXISTS "chat_vod_idx" ON "chat_messages" ("vod_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_parent_idx" ON "chat_messages" ("parent_id");
