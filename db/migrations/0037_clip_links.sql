-- A clip can point at the show or the episode it was cut from.
--
-- `clips.vod_id` and `clips.stream_id` already exist, which covers "cut from a
-- recording" and "cut from a live broadcast". Neither covers an episode of an
-- original, because an episode is a row in `episodes`, not a VOD, and that is
-- exactly the case the CMS needs: a trailer for a show, a highlight from
-- episode three.
--
-- Both are nullable and both are kept, rather than only the episode: a clip
-- promoting a series as a whole belongs to the show and to no single episode.
-- When an episode is set, the show is set too, so a query for "clips for this
-- show" never has to join through episodes to find them.
--
-- ON DELETE SET NULL, matching `vod_id`: deleting a show should orphan its
-- clips, not silently destroy media somebody uploaded.
--
-- The foreign keys are added inside a guard because `shows` and `episodes` are
-- not created by this migration chain at all: they were pushed straight to the
-- database. On a machine where they are missing, the columns still land and the
-- constraints are skipped, which is better than the whole chain refusing to run.
ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "show_id" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "episode_id" text;--> statement-breakpoint

DO $$
BEGIN
  IF to_regclass('public.shows') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'clips_show_id_shows_id_fk'
     )
  THEN
    ALTER TABLE "clips"
      ADD CONSTRAINT "clips_show_id_shows_id_fk"
      FOREIGN KEY ("show_id") REFERENCES "shows"("id") ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.episodes') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'clips_episode_id_episodes_id_fk'
     )
  THEN
    ALTER TABLE "clips"
      ADD CONSTRAINT "clips_episode_id_episodes_id_fk"
      FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE SET NULL;
  END IF;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "clips_show_idx" ON "clips" ("show_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clips_episode_idx" ON "clips" ("episode_id");
