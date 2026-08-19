-- A programme does not have to be one of the three.
--
-- `pillar` was NOT NULL with a default of 'esports', so anything that was
-- neither esports, anime nor lifestyle was filed as esports and appeared under
-- that filter on the schedule. There was no way to say "none of these", and an
-- operator's only option was to pick the wrong one.
--
-- Null means unfiled: the row appears under Everything and under no pillar
-- filter. Existing rows keep whatever they hold, including the ones that were
-- defaulted, because this cannot tell those apart from a deliberate choice.
--
-- The default goes too. A new row with no pillar is now unfiled rather than
-- quietly esports, which is the whole point.
ALTER TABLE "streams" ALTER COLUMN "pillar" DROP NOT NULL;
ALTER TABLE "streams" ALTER COLUMN "pillar" DROP DEFAULT;

ALTER TABLE "shows" ALTER COLUMN "pillar" DROP NOT NULL;
ALTER TABLE "shows" ALTER COLUMN "pillar" DROP DEFAULT;

ALTER TABLE "epg_slots" ALTER COLUMN "pillar" DROP NOT NULL;
ALTER TABLE "epg_slots" ALTER COLUMN "pillar" DROP DEFAULT;
