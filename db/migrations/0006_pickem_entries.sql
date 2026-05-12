CREATE TABLE "pickem_entries" (
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"picks" jsonb NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickem_entries_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "pickem_entries" ADD CONSTRAINT "pickem_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_entries" ADD CONSTRAINT "pickem_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pickem_entries_event_idx" ON "pickem_entries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "pickem_entries_score_idx" ON "pickem_entries" USING btree ("event_id","score");