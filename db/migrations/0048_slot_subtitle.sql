-- The second line of a slot becomes a field of its own.
--
-- The imported grid stored one string per slot, `A \ B`, and the site split it
-- on the backslash to draw the line under the programme name. So the owner
-- renamed a show, watched "NEED FOR SPEED" stay on air, and had nowhere to go
-- and change it: it was not a show, not a field, and not editable anywhere.
--
-- The first half is the programme and belongs to the show. The second half is
-- what that hour is, which is a property of the slot, so it gets a column and
-- an editor rather than a parsing rule.
ALTER TABLE "epg_slots" ADD COLUMN IF NOT EXISTS "subtitle" text;

UPDATE "epg_slots"
SET "subtitle" = btrim(split_part("title", '\', 2)),
    "title" = btrim(split_part("title", '\', 1))
WHERE position('\' in "title") > 0;
