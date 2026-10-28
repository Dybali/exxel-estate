CREATE TABLE `individual_listing_quota` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_submitted_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `listing_submissions` (
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`listing_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `request_id`)
);
--> statement-breakpoint
ALTER TABLE `listings` ADD `expires_at` text;