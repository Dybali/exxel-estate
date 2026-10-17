CREATE TABLE `discovery_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`price_seen_at` text NOT NULL,
	`price_enabled` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`old_price` integer NOT NULL,
	`new_price` integer NOT NULL,
	`currency` text NOT NULL,
	`purpose` text NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `price_history_listing_idx` ON `price_history` (`listing_id`,`changed_at`);--> statement-breakpoint
CREATE TABLE `saved_searches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`query` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`seen_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_searches_pair_unique` ON `saved_searches` (`user_id`,`query`);--> statement-breakpoint
CREATE INDEX `saved_searches_user_idx` ON `saved_searches` (`user_id`);--> statement-breakpoint
ALTER TABLE `listings` ADD `published_at` text;
--> statement-breakpoint
UPDATE listings SET published_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE status='published' AND published_at IS NULL;

