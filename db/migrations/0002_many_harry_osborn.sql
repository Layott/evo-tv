CREATE TABLE `likes` (
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `target_type`, `target_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `likes_target_idx` ON `likes` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `likes_recent_idx` ON `likes` (`created_at`);