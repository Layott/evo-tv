CREATE TABLE "parties" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"host_user_id" text NOT NULL,
	"stream_id" text,
	"max_members" integer DEFAULT 20 NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"invite_code" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "party_members" (
	"party_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "party_members_party_id_user_id_pk" PRIMARY KEY("party_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_host_user_id_user_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_members" ADD CONSTRAINT "party_members_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_members" ADD CONSTRAINT "party_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parties_host_idx" ON "parties" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "parties_invite_idx" ON "parties" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "party_members_user_idx" ON "party_members" USING btree ("user_id");