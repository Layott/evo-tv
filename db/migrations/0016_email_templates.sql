CREATE TABLE "email_templates" (
	"key" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"html_body" text NOT NULL,
	"text_body" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_templates_updated_idx" ON "email_templates" USING btree ("updated_at");
