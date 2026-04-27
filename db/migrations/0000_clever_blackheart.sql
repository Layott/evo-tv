CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`cover_url` text NOT NULL,
	`icon_url` text NOT NULL,
	`category` text NOT NULL,
	`platform` text NOT NULL,
	`active_players` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_slug_unique` ON `games` (`slug`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`real_name` text NOT NULL,
	`avatar_url` text NOT NULL,
	`team_id` text,
	`game_id` text NOT NULL,
	`role` text NOT NULL,
	`country` text NOT NULL,
	`kda_x100` integer DEFAULT 0 NOT NULL,
	`followers` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `players_team_idx` ON `players` (`team_id`);--> statement-breakpoint
CREATE INDEX `players_game_idx` ON `players` (`game_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`tag` text NOT NULL,
	`logo_url` text NOT NULL,
	`country` text NOT NULL,
	`region` text NOT NULL,
	`game_id` text NOT NULL,
	`ranking` integer DEFAULT 0 NOT NULL,
	`followers` integer DEFAULT 0 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_slug_unique` ON `teams` (`slug`);--> statement-breakpoint
CREATE INDEX `teams_game_idx` ON `teams` (`game_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`items` text NOT NULL,
	`subtotal_ngn` integer NOT NULL,
	`shipping_ngn` integer DEFAULT 0 NOT NULL,
	`total_ngn` integer NOT NULL,
	`shipping` text,
	`payment_provider` text DEFAULT 'mock' NOT NULL,
	`payment_ref` text NOT NULL,
	`created_at` text NOT NULL,
	`tracking_number` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`price_ngn` integer NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`variants` text DEFAULT '[]' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`team_id` text,
	`inventory` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tier` text NOT NULL,
	`status` text NOT NULL,
	`provider` text NOT NULL,
	`provider_sub_id` text DEFAULT '' NOT NULL,
	`current_period_end` text NOT NULL,
	`price_ngn` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subs_user_idx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `event_teams` (
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	PRIMARY KEY(`event_id`, `team_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`game_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`status` text NOT NULL,
	`tier` text NOT NULL,
	`banner_url` text NOT NULL,
	`thumbnail_url` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`prize_pool_ngn` integer DEFAULT 0 NOT NULL,
	`region` text NOT NULL,
	`format` text DEFAULT '' NOT NULL,
	`viewer_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `events_status_idx` ON `events` (`status`);--> statement-breakpoint
CREATE INDEX `events_game_idx` ON `events` (`game_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_a_id` text,
	`team_b_id` text,
	`scheduled_at` text NOT NULL,
	`state` text NOT NULL,
	`score_a` integer DEFAULT 0 NOT NULL,
	`score_b` integer DEFAULT 0 NOT NULL,
	`round` text DEFAULT '' NOT NULL,
	`best_of` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_a_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`team_b_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `matches_event_idx` ON `matches` (`event_id`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text DEFAULT '' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`country` text DEFAULT 'NG' NOT NULL,
	`onboarded_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`handle` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_handle_unique` ON `user` (`handle`);--> statement-breakpoint
CREATE INDEX `user_email_idx` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `user_handle_idx` ON `user` (`handle`);--> statement-breakpoint
CREATE TABLE `user_prefs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`favorite_games` text DEFAULT '[]' NOT NULL,
	`favorite_teams` text DEFAULT '[]' NOT NULL,
	`favorite_players` text DEFAULT '[]' NOT NULL,
	`notif_opt_in` text NOT NULL,
	`playback` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`stream_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`stream_id`) REFERENCES `streams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_stream_idx` ON `chat_messages` (`stream_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `clips` (
	`id` text PRIMARY KEY NOT NULL,
	`vod_id` text,
	`stream_id` text,
	`title` text NOT NULL,
	`creator_handle` text NOT NULL,
	`creator_avatar_url` text DEFAULT '' NOT NULL,
	`duration_sec` integer NOT NULL,
	`mp4_path` text DEFAULT '' NOT NULL,
	`thumbnail_url` text DEFAULT '' NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`game_id` text NOT NULL,
	FOREIGN KEY (`vod_id`) REFERENCES `vods`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`stream_id`) REFERENCES `streams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clips_game_idx` ON `clips` (`game_id`);--> statement-breakpoint
CREATE TABLE `follows` (
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `target_type`, `target_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `poll_votes` (
	`user_id` text NOT NULL,
	`poll_id` text NOT NULL,
	`option_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `poll_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `polls` (
	`id` text PRIMARY KEY NOT NULL,
	`stream_id` text NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`created_at` text NOT NULL,
	`closes_at` text NOT NULL,
	`is_closed` integer DEFAULT false NOT NULL,
	`total_votes` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`stream_id`) REFERENCES `streams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `streams` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`event_id` text,
	`game_id` text NOT NULL,
	`streamer_type` text DEFAULT 'official' NOT NULL,
	`streamer_name` text NOT NULL,
	`streamer_avatar_url` text DEFAULT '' NOT NULL,
	`stream_key_hash` text NOT NULL,
	`is_live` integer DEFAULT false NOT NULL,
	`started_at` text,
	`ended_at` text,
	`hls_path` text DEFAULT '' NOT NULL,
	`thumbnail_url` text DEFAULT '' NOT NULL,
	`viewer_count` integer DEFAULT 0 NOT NULL,
	`peak_viewer_count` integer DEFAULT 0 NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`is_premium` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `streams_stream_key_hash_unique` ON `streams` (`stream_key_hash`);--> statement-breakpoint
CREATE INDEX `streams_live_idx` ON `streams` (`is_live`);--> statement-breakpoint
CREATE INDEX `streams_game_idx` ON `streams` (`game_id`);--> statement-breakpoint
CREATE TABLE `vod_progress` (
	`user_id` text NOT NULL,
	`vod_id` text NOT NULL,
	`position_sec` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `vod_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vod_id`) REFERENCES `vods`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vods` (
	`id` text PRIMARY KEY NOT NULL,
	`stream_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`game_id` text NOT NULL,
	`duration_sec` integer NOT NULL,
	`hls_path` text DEFAULT '' NOT NULL,
	`mp4_path` text DEFAULT '' NOT NULL,
	`thumbnail_url` text DEFAULT '' NOT NULL,
	`published_at` text NOT NULL,
	`chapters` text DEFAULT '[]' NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`is_premium` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`stream_id`) REFERENCES `streams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vods_game_idx` ON `vods` (`game_id`);--> statement-breakpoint
CREATE INDEX `vods_published_idx` ON `vods` (`published_at`);--> statement-breakpoint
CREATE TABLE `ads` (
	`id` text PRIMARY KEY NOT NULL,
	`placement` text NOT NULL,
	`media_url` text NOT NULL,
	`click_url` text NOT NULL,
	`advertiser` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`weight` integer DEFAULT 100 NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ads_placement_active_idx` ON `ads` (`placement`,`active`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`meta` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `feature_flags` (
	`key` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`payload` text
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`image_url` text,
	`link_url` text,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`user_id`,`read_at`);