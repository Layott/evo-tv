CREATE TABLE "creator_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bio" text NOT NULL,
	"country" text NOT NULL,
	"primary_game_id" text NOT NULL,
	"social_platform" text NOT NULL,
	"social_handle" text NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"agreement_accepted" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"submitted_at" text NOT NULL,
	"reviewed_at" text,
	"reviewer_note" text,
	CONSTRAINT "creator_applications_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "creator_applications" ADD CONSTRAINT "creator_applications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creator_apps_status_idx" ON "creator_applications" USING btree ("status","submitted_at");
