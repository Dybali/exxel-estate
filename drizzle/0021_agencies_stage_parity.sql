CREATE TABLE `agencies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`category` text DEFAULT 'agency' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agencies_owner_unique` ON `agencies` (`owner_id`);--> statement-breakpoint
CREATE TABLE `listing_view_daily` (
	`listing_id` text NOT NULL,
	`day` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`listing_id`, `day`, `visitor_hash`)
);
