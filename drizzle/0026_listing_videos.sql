-- Self-hosted listing videos; mirrors postgres/migrations/019_listing_videos.sql.
CREATE TABLE IF NOT EXISTS `listing_videos` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `listing_id` text REFERENCES `listings`(`id`) ON DELETE SET NULL,
  `status` text DEFAULT 'uploading' NOT NULL CHECK (`status` IN ('uploading','queued','processing','ready','failed')),
  `upload_id` text,
  `raw_key` text NOT NULL,
  `mp4_key` text,
  `poster_key` text,
  `content_type` text NOT NULL,
  `size_bytes` integer NOT NULL,
  `duration_seconds` real,
  `width` integer,
  `height` integer,
  `error` text,
  `attempts` integer DEFAULT 0 NOT NULL,
  `locked_until` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `listing_videos_owner_idx` ON `listing_videos` (`owner_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `listing_videos_listing_idx` ON `listing_videos` (`listing_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `listing_videos_queue_idx` ON `listing_videos` (`status`,`updated_at`);
