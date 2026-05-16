CREATE TABLE "daily_quest_claims" (
	"user_id" text NOT NULL,
	"quest_id" text NOT NULL,
	"day_key" text NOT NULL,
	"reward_coins" integer NOT NULL,
	"reward_xp" integer NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_quest_claims" ADD CONSTRAINT "daily_quest_claims_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_quest_claims_user_idx" ON "daily_quest_claims" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "daily_quest_claims_day_idx" ON "daily_quest_claims" USING btree ("day_key");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_quest_claims_unique_per_day" ON "daily_quest_claims" USING btree ("user_id","quest_id","day_key");
