CREATE TABLE IF NOT EXISTS `message_receipts` (
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_at` text NOT NULL,
	PRIMARY KEY(`message_id`, `user_id`),
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

