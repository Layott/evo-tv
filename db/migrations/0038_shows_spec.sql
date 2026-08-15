-- The Shows CMS, as the owner actually wants it.
--
-- Four changes, all driven by the same idea: a show is the thing, and
-- everything else points at it.
--
-- 1. `epg_slots.show_id`. A programme in the weekly grid was a typed string, so
--    "Otaku & Chillz" in the grid and "Otaku and Chillz" on the show page were
--    two unrelated pieces of text that happened to look alike. Scheduling now
--    picks a show. The 31 distinct titles already in the grid are turned into
--    shows below and the slots are pointed at them, so nothing has to be
--    retyped and no slot loses its name.
--
-- 2. `shows.social_links`. `primary_creator_handle` was one string with no
--    platform attached to it. Viewers get a row of links instead: Instagram,
--    TikTok, YouTube, X, whatever the creator actually has.
--
-- 3. `shows.ended_at`. Status is no longer something an admin picks off a list.
--    It is derived from what is happening: airing, upcoming and hiatus all fall
--    out of the episodes and the grid. The single thing that cannot be derived
--    is whether a series has finished for good, so that is one explicit date
--    rather than a status dropdown that could contradict the data.
--
-- 4. `show_price_windows`. A paid show can change price over time and can stop
--    being paid: "N800 for the first two days, N500 after that, free after two
--    weeks" is three rows. Each row says "from this many days after release,
--    this is the price", and a price of zero means free from then on.
ALTER TABLE "shows" ADD COLUMN IF NOT EXISTS "social_links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN IF NOT EXISTS "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "epg_slots" ADD COLUMN IF NOT EXISTS "show_id" text;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "show_price_windows" (
  "id" text PRIMARY KEY NOT NULL,
  "show_id" text NOT NULL,
  -- Days after the show's release date. 0 is the price on day one.
  "from_day" integer DEFAULT 0 NOT NULL,
  -- Kobo-free whole naira, matching `subscriptions.price_ngn`. Zero means free
  -- from this day on, which is how "paid for two weeks" is expressed.
  "price_ngn" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "show_price_windows_show_day_idx"
  ON "show_price_windows" ("show_id", "from_day");--> statement-breakpoint

-- Backfill: every distinct title in the grid becomes a show, and its slots are
-- pointed at it.
--
-- Guarded because `shows` is not created by this migration chain: it was pushed
-- straight to the database, so on a machine without it the columns above still
-- land and this step is skipped rather than failing the whole run.
DO $$
BEGIN
  IF to_regclass('public.shows') IS NULL THEN
    RETURN;
  END IF;

  -- One row per title. `pillar` comes from the slot, so an anime programme
  -- arrives filed under anime. Slug is the title reduced to url-safe text, with
  -- a numeric suffix only where two titles reduce to the same thing.
  INSERT INTO "shows" (id, slug, title, pillar, origin_type, status, synopsis)
  SELECT
    'show_grid_' || substr(md5(g.title), 1, 12),
    CASE WHEN g.rn = 1 THEN g.base_slug ELSE g.base_slug || '-' || g.rn END,
    g.title,
    g.pillar,
    'evo_original',
    'airing',
    ''
  FROM (
    SELECT
      s.title,
      min(s.pillar) AS pillar,
      trim(both '-' from regexp_replace(lower(s.title), '[^a-z0-9]+', '-', 'g')) AS base_slug,
      row_number() OVER (
        PARTITION BY trim(both '-' from regexp_replace(lower(s.title), '[^a-z0-9]+', '-', 'g'))
        ORDER BY s.title
      ) AS rn
    FROM "epg_slots" s
    WHERE s.is_active
    GROUP BY s.title
  ) g
  WHERE NOT EXISTS (SELECT 1 FROM "shows" x WHERE x.title = g.title)
    AND NOT EXISTS (
      SELECT 1 FROM "shows" x
      WHERE x.slug = CASE WHEN g.rn = 1 THEN g.base_slug ELSE g.base_slug || '-' || g.rn END
    );

  UPDATE "epg_slots" s
  SET show_id = x.id
  FROM "shows" x
  WHERE s.show_id IS NULL AND x.title = s.title;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'epg_slots_show_id_shows_id_fk'
  ) THEN
    ALTER TABLE "epg_slots"
      ADD CONSTRAINT "epg_slots_show_id_shows_id_fk"
      FOREIGN KEY ("show_id") REFERENCES "shows"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'show_price_windows_show_id_shows_id_fk'
  ) THEN
    ALTER TABLE "show_price_windows"
      ADD CONSTRAINT "show_price_windows_show_id_shows_id_fk"
      FOREIGN KEY ("show_id") REFERENCES "shows"("id") ON DELETE CASCADE;
  END IF;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "epg_slots_show_idx" ON "epg_slots" ("show_id");
