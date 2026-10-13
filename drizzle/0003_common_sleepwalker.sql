CREATE TABLE `oauth_accounts` (
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_accounts_provider_user_unique` ON `oauth_accounts` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_accounts_user_provider_unique` ON `oauth_accounts` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `oauth_flows` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`code_verifier` text NOT NULL,
	`role` text NOT NULL,
	`next_path` text NOT NULL,
	`link_user_id` text,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_flows_expiry_idx` ON `oauth_flows` (`expires_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified` integer DEFAULT false NOT NULL;