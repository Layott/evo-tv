-- Streams do not always have a game.
--
-- EVO TV is esports, anime and lifestyle. `streams.game_id` was NOT NULL with a
-- foreign key to `games`, so an operator scheduling "Otaku and Chills" or a
-- podcast had to pick Free Fire or CoD Mobile, and viewers then saw that game
-- badge on an anime programme. Two of the three pillars could not be entered
-- honestly.
--
-- The column stays a foreign key, so an esports stream still points at a real
-- game. It is simply optional now. `pillar` is what classifies a programme.
--
-- Widening a NOT NULL to nullable does not rewrite the table and takes no
-- long lock, and it is backwards compatible: every existing row keeps its game.
ALTER TABLE "streams" ALTER COLUMN "game_id" DROP NOT NULL;--> statement-breakpoint
-- Same for the recording. A VOD of an anime episode has no game, and the
-- transcode worker copies `game_id` straight off the stream it recorded.
ALTER TABLE "vods" ALTER COLUMN "game_id" DROP NOT NULL;
