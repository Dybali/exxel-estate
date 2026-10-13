CREATE INDEX `listings_location_idx` ON `listings` (`status`,`city`,`district`);--> statement-breakpoint
CREATE INDEX `listings_price_idx` ON `listings` (`status`,`price`);--> statement-breakpoint
CREATE INDEX `listings_recent_idx` ON `listings` (`status`,`created_at`);