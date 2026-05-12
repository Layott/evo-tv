CREATE TABLE "analytics_daily" (
	"channel_id" text NOT NULL,
	"date" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"unique_viewers" integer DEFAULT 0 NOT NULL,
	"watch_minutes" integer DEFAULT 0 NOT NULL,
	"peak_concurrent" integer DEFAULT 0 NOT NULL,
	"followers_gained" integer DEFAULT 0 NOT NULL,
	"followers_lost" integer DEFAULT 0 NOT NULL,
	"tip_coins_received" integer DEFAULT 0 NOT NULL,
	"tip_count" integer DEFAULT 0 NOT NULL,
	"product_orders" integer DEFAULT 0 NOT NULL,
	"product_revenue_ngn" integer DEFAULT 0 NOT NULL,
	"ad_impressions" integer DEFAULT 0 NOT NULL,
	"ad_revenue_ngn" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_daily_channel_id_date_pk" PRIMARY KEY("channel_id","date")
);
--> statement-breakpoint
CREATE TABLE "channel_followers" (
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_followers_channel_id_user_id_pk" PRIMARY KEY("channel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "channel_stream_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"key_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone,
	CONSTRAINT "channel_stream_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"logo_url" text DEFAULT '' NOT NULL,
	"banner_url" text DEFAULT '' NOT NULL,
	"brand_color" text DEFAULT '#2CD7E3' NOT NULL,
	"category" text DEFAULT 'esports' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_evotv_owned" boolean DEFAULT false NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher_id" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"gross_ngn" integer DEFAULT 0 NOT NULL,
	"fee_ngn" integer DEFAULT 0 NOT NULL,
	"net_ngn" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paystack_transfer_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "publisher_members" (
	"publisher_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "publisher_members_publisher_id_user_id_pk" PRIMARY KEY("publisher_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "publishers" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"country" text DEFAULT 'NG' NOT NULL,
	"kyc_state" text DEFAULT 'pending' NOT NULL,
	"payout_method" text DEFAULT 'manual' NOT NULL,
	"payout_payload" jsonb,
	"revenue_share_pct" integer DEFAULT 70 NOT NULL,
	"is_evotv_owned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publishers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "watch_events" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"stream_id" text,
	"user_id" text,
	"minute_bucket" text NOT NULL,
	"ip_hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "channel_id" text;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN "channel_id" text;--> statement-breakpoint
ALTER TABLE "vods" ADD COLUMN "channel_id" text;--> statement-breakpoint
ALTER TABLE "tips" ADD COLUMN "channel_id" text;--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_followers" ADD CONSTRAINT "channel_followers_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_followers" ADD CONSTRAINT "channel_followers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_stream_keys" ADD CONSTRAINT "channel_stream_keys_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publisher_members" ADD CONSTRAINT "publisher_members_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publisher_members" ADD CONSTRAINT "publisher_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_events" ADD CONSTRAINT "watch_events_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_events" ADD CONSTRAINT "watch_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_daily_date_idx" ON "analytics_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX "channel_followers_user_idx" ON "channel_followers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "channel_stream_keys_channel_idx" ON "channel_stream_keys" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "channel_stream_keys_active_idx" ON "channel_stream_keys" USING btree ("active");--> statement-breakpoint
CREATE INDEX "channels_publisher_idx" ON "channels" USING btree ("publisher_id");--> statement-breakpoint
CREATE INDEX "channels_slug_idx" ON "channels" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "payouts_publisher_idx" ON "payouts" USING btree ("publisher_id");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "publisher_members_user_idx" ON "publisher_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "publishers_slug_idx" ON "publishers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "watch_events_channel_bucket_idx" ON "watch_events" USING btree ("channel_id","minute_bucket");--> statement-breakpoint
CREATE INDEX "watch_events_created_idx" ON "watch_events" USING btree ("created_at");