CREATE TABLE `content_translations` (
	`key` text PRIMARY KEY NOT NULL,
	`translated_text` text NOT NULL,
	`detected_language` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `translation_leases` (
	`key` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`lease_until` integer NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `translation_usage` (
	`key` text PRIMARY KEY NOT NULL,
	`characters` integer DEFAULT 0 NOT NULL
);
