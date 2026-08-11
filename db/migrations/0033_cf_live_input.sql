-- Cloudflare Stream live inputs, and a home for the ingest each stream uses.
--
-- `cf_live_input_uid` is the Cloudflare live input this stream broadcasts to.
-- Playback is keyed on the input rather than on an individual recording, so
-- the manifest URL stays valid across every stop and restart and an operator
-- never has to paste a URL again.
--
-- Null means this stream is not on Cloudflare: either it uses the self-hosted
-- RTMP path, or its manifest was set by hand. Both remain supported.
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "cf_live_input_uid" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "streams_cf_live_input_idx" ON "streams" ("cf_live_input_uid") WHERE "cf_live_input_uid" IS NOT NULL;--> statement-breakpoint
-- Which ingest a stream expects, so the admin UI can show the right
-- instructions and a reconcile sweep knows what to ask.
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "ingest_kind" text NOT NULL DEFAULT 'manual';
