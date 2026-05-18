CREATE TABLE IF NOT EXISTS "match_player_stats" (
	"match_id" text NOT NULL,
	"player_id" text NOT NULL,
	"kills" integer DEFAULT 0 NOT NULL,
	"deaths" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"objectives" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "match_player_stats_pk" PRIMARY KEY ("match_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "match_player_stats" ADD CONSTRAINT "match_player_stats_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_player_stats_player_idx" ON "match_player_stats" USING btree ("player_id");
