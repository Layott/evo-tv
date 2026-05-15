CREATE TABLE "content_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_user_id" text,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"category" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" text,
	"resolution_notes" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_reports_status_idx" ON "content_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "content_reports_target_idx" ON "content_reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "content_reports_reporter_idx" ON "content_reports" USING btree ("reporter_user_id");
