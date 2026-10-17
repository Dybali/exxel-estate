CREATE TABLE `property_images` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`storage_provider` text DEFAULT 'r2' NOT NULL,
	`bucket` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`checksum_sha256` text,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `property_images_object_key_unique` ON `property_images` (`object_key`);--> statement-breakpoint
CREATE INDEX `property_images_property_idx` ON `property_images` (`property_id`,`sort_order`);