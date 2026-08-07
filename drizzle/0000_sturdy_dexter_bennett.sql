CREATE TABLE `canlii_metadata_cache` (
	`appeal_number` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`payload` text,
	`fetched_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `canlii_rate_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`last_started_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `canlii_request_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requested_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `canlii_request_log_requested_at_idx` ON `canlii_request_log` (`requested_at`);