-- The catalogue kept the compound names the grid gave up.
--
-- 0048 split `epg_slots.title` on the backslash and made the second half a
-- field. The grid then started reading the show's own name, and some shows were
-- imported carrying the same compound string in `shows.title`
-- (`NEED FOR SPEED \ APEX LEGENDS`), so the backslash came straight back on air
-- through the catalogue instead of the schedule.
--
-- The second half belongs to the hour, so it goes to the slot when the slot has
-- nothing of its own, and the show is left with its actual name.
UPDATE "epg_slots" s
SET "subtitle" = btrim(split_part(sh."title", '\', 2))
FROM "shows" sh
WHERE s."show_id" = sh."id"
  AND position('\' in sh."title") > 0
  AND coalesce(s."subtitle", '') = '';

UPDATE "shows"
SET "title" = btrim(split_part("title", '\', 1))
WHERE position('\' in "title") > 0;
