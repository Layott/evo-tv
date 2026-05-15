CREATE TABLE "party_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"party_id" text NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "party_messages" ADD CONSTRAINT "party_messages_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_messages" ADD CONSTRAINT "party_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "party_messages_party_created_idx" ON "party_messages" USING btree ("party_id","created_at");