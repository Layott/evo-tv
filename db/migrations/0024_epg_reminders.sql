CREATE TABLE IF NOT EXISTS "epg_reminders" (
	"user_id" text NOT NULL,
	"target_id" text NOT NULL,
	"airs_at" text NOT NULL,
	"lead_min" integer DEFAULT 15 NOT NULL,
	"notified_at" text,
	"created_at" text NOT NULL,
	CONSTRAINT "epg_reminders_pk" PRIMARY KEY ("user_id","target_id")
);
--> statement-breakpoint
ALTER TABLE "epg_reminders" ADD CONSTRAINT "epg_reminders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "epg_reminders_due_idx" ON "epg_reminders" USING btree ("airs_at") WHERE "notified_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "epg_reminders_user_idx" ON "epg_reminders" USING btree ("user_id");
