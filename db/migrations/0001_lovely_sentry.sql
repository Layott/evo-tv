CREATE TABLE "coin_balances" (
	"user_id" text PRIMARY KEY NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards_drops" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"cost" integer NOT NULL,
	"stock" integer NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"partner" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"rarity" text DEFAULT 'common' NOT NULL,
	"expires_at" timestamp,
	"active" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards_redemptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"drop_id" text NOT NULL,
	"code" text NOT NULL,
	"cost" integer NOT NULL,
	"status" text DEFAULT 'delivered' NOT NULL,
	"redeemed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tips" (
	"id" text PRIMARY KEY NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"stream_id" text,
	"coins" integer NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"points" integer NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coin_balances" ADD CONSTRAINT "coin_balances_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards_redemptions" ADD CONSTRAINT "rewards_redemptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards_redemptions" ADD CONSTRAINT "rewards_redemptions_drop_id_rewards_drops_id_fk" FOREIGN KEY ("drop_id") REFERENCES "public"."rewards_drops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rewards_drops_kind_idx" ON "rewards_drops" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "rewards_drops_category_idx" ON "rewards_drops" USING btree ("category");--> statement-breakpoint
CREATE INDEX "rewards_redemptions_user_idx" ON "rewards_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rewards_redemptions_drop_idx" ON "rewards_redemptions" USING btree ("drop_id");--> statement-breakpoint
CREATE INDEX "tips_from_idx" ON "tips" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "tips_to_idx" ON "tips" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "xp_events_user_idx" ON "xp_events" USING btree ("user_id");