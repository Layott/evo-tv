CREATE TABLE "user_sanctions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"issued_by" text NOT NULL,
	"expires_at" text,
	"reverted_at" text,
	"reverted_by" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_issued_by_user_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_reverted_by_user_id_fk" FOREIGN KEY ("reverted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_sanctions_user_idx" ON "user_sanctions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sanctions_kind_idx" ON "user_sanctions" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "user_sanctions_active_idx" ON "user_sanctions" USING btree ("user_id","kind","reverted_at");
