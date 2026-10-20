CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`slot_at` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`stage` text DEFAULT 'new' NOT NULL,
	`private_note` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `appointments_buyer_idx` ON `appointments` (`buyer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `appointments_seller_idx` ON `appointments` (`seller_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `listings` ADD `presentation` text DEFAULT '{}' NOT NULL;