CREATE TABLE "login_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ip_hash" text,
	"region" text,
	"user_agent" text,
	"device_fp" text,
	"method" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_events_user_idx" ON "login_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "login_events_ip_idx" ON "login_events" USING btree ("ip_hash");--> statement-breakpoint
CREATE INDEX "login_events_fp_idx" ON "login_events" USING btree ("device_fp");
