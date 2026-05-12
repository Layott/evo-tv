CREATE TABLE "prediction_picks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"match_id" text NOT NULL,
	"team_picked_id" text NOT NULL,
	"coins_staked" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"payout_coins" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "prediction_picks" ADD CONSTRAINT "prediction_picks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_picks" ADD CONSTRAINT "prediction_picks_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prediction_picks_user_idx" ON "prediction_picks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "prediction_picks_match_idx" ON "prediction_picks" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "prediction_picks_status_idx" ON "prediction_picks" USING btree ("status");