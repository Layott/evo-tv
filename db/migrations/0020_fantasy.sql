CREATE TABLE "fantasy_leagues" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"game_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"max_members" integer DEFAULT 10 NOT NULL,
	"salary_cap" integer NOT NULL,
	"prize_pool" integer DEFAULT 0 NOT NULL,
	"entry_fee" integer DEFAULT 0 NOT NULL,
	"scoring_system" text NOT NULL,
	"status" text DEFAULT 'drafting' NOT NULL,
	"ends_at" text NOT NULL,
	"banner_seed" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fantasy_league_members" (
	"league_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" text NOT NULL,
	CONSTRAINT "fantasy_league_members_league_id_user_id_pk" PRIMARY KEY ("league_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "fantasy_lineups" (
	"id" text PRIMARY KEY NOT NULL,
	"league_id" text NOT NULL,
	"user_id" text NOT NULL,
	"total_cost" integer DEFAULT 0 NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"submitted_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fantasy_lineup_picks" (
	"lineup_id" text NOT NULL,
	"player_id" text NOT NULL,
	"cost" integer NOT NULL,
	"points_scored" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "fantasy_lineup_picks_lineup_id_player_id_pk" PRIMARY KEY ("lineup_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "fantasy_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"league_id" text NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fantasy_leagues" ADD CONSTRAINT "fantasy_leagues_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_league_members" ADD CONSTRAINT "fantasy_league_members_league_id_fantasy_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."fantasy_leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_league_members" ADD CONSTRAINT "fantasy_league_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_lineups" ADD CONSTRAINT "fantasy_lineups_league_id_fantasy_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."fantasy_leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_lineups" ADD CONSTRAINT "fantasy_lineups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_lineup_picks" ADD CONSTRAINT "fantasy_lineup_picks_lineup_id_fantasy_lineups_id_fk" FOREIGN KEY ("lineup_id") REFERENCES "public"."fantasy_lineups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_activity" ADD CONSTRAINT "fantasy_activity_league_id_fantasy_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."fantasy_leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fantasy_leagues_game_idx" ON "fantasy_leagues" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "fantasy_leagues_owner_idx" ON "fantasy_leagues" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "fantasy_members_user_idx" ON "fantasy_league_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fantasy_lineups_league_idx" ON "fantasy_lineups" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX "fantasy_lineups_user_idx" ON "fantasy_lineups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fantasy_lineup_picks_lineup_idx" ON "fantasy_lineup_picks" USING btree ("lineup_id");--> statement-breakpoint
CREATE INDEX "fantasy_activity_league_idx" ON "fantasy_activity" USING btree ("league_id","created_at");
