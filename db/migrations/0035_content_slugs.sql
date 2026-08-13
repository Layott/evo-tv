-- Slugs for the three content tables that never had them.
--
-- shows, events, products, channels, teams and games have carried a unique
-- slug for a long time. streams, vods and clips never did, so the only way to
-- address one was an opaque id: /vod/vod_5af9044cafaae364 is not something
-- anybody pastes into a message on purpose, and it tells a search engine
-- nothing about what is on the page.
--
-- Nullable, not NOT NULL. A null slug means "address this row by its id", which
-- is exactly what every existing link already does, so nothing breaks while
-- rows written by older code drain out. The unique index still applies: in
-- Postgres, multiple NULLs do not collide.
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
ALTER TABLE "vods" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "streams_slug_idx" ON "streams" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vods_slug_idx" ON "vods" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clips_slug_idx" ON "clips" ("slug");--> statement-breakpoint

-- Backfill.
--
-- This has to produce the same string `lib/slug.ts` would, or a row filled in
-- here gets a different URL from one the app creates. Lowercase, everything
-- that is not a letter or digit becomes a hyphen, runs collapse, ends trimmed,
-- capped at 80.
--
-- `row_number` handles two rows sharing a title: the first keeps the clean
-- slug, the rest take a suffix off the tail of their id, which is already
-- unique. Rows whose title slugifies to nothing are left null and stay
-- addressable by id.
WITH candidate AS (
  SELECT
    id,
    left(trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), 80) AS base
  FROM "streams"
  WHERE "slug" IS NULL
),
ranked AS (
  SELECT id, base, row_number() OVER (PARTITION BY base ORDER BY id) AS rn
  FROM candidate
  WHERE base <> ''
)
UPDATE "streams" s
SET "slug" = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || right(s.id, 6) END
FROM ranked r
WHERE s.id = r.id;--> statement-breakpoint

WITH candidate AS (
  SELECT
    id,
    left(trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), 80) AS base
  FROM "vods"
  WHERE "slug" IS NULL
),
ranked AS (
  SELECT id, base, row_number() OVER (PARTITION BY base ORDER BY id) AS rn
  FROM candidate
  WHERE base <> ''
)
UPDATE "vods" v
SET "slug" = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || right(v.id, 6) END
FROM ranked r
WHERE v.id = r.id;--> statement-breakpoint

WITH candidate AS (
  SELECT
    id,
    left(trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), 80) AS base
  FROM "clips"
  WHERE "slug" IS NULL
),
ranked AS (
  SELECT id, base, row_number() OVER (PARTITION BY base ORDER BY id) AS rn
  FROM candidate
  WHERE base <> ''
)
UPDATE "clips" c
SET "slug" = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || right(c.id, 6) END
FROM ranked r
WHERE c.id = r.id;
