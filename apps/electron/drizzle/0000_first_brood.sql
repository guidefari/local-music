CREATE TABLE `library_source` (
	`id` text PRIMARY KEY NOT NULL,
	`root_path` text NOT NULL,
	`added_at` integer NOT NULL,
	`last_successful_scan_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_source_root_path_unique` ON `library_source` (`root_path`);--> statement-breakpoint
CREATE TABLE `scan_stage_path` (
	`scan_id` text NOT NULL,
	`source_id` text NOT NULL,
	`relative_path` text NOT NULL,
	`read_state` text NOT NULL,
	`observed_title` text,
	`observed_artist` text,
	`observed_album` text,
	`duration_seconds` integer,
	`has_embedded_artwork` integer,
	`artwork_id` text,
	`artwork_mime_type` text,
	PRIMARY KEY(`scan_id`, `source_id`, `relative_path`),
	FOREIGN KEY (`source_id`) REFERENCES `library_source`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stage_observation_complete" CHECK(("scan_stage_path"."read_state" = 'unreadable' AND "scan_stage_path"."observed_title" IS NULL AND "scan_stage_path"."observed_artist" IS NULL AND "scan_stage_path"."observed_album" IS NULL AND "scan_stage_path"."duration_seconds" IS NULL AND "scan_stage_path"."has_embedded_artwork" IS NULL AND "scan_stage_path"."artwork_id" IS NULL AND "scan_stage_path"."artwork_mime_type" IS NULL) OR ("scan_stage_path"."read_state" = 'observed' AND "scan_stage_path"."observed_title" IS NOT NULL AND "scan_stage_path"."observed_artist" IS NOT NULL AND "scan_stage_path"."observed_album" IS NOT NULL AND "scan_stage_path"."duration_seconds" IS NOT NULL AND "scan_stage_path"."has_embedded_artwork" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `track` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`relative_path` text NOT NULL,
	`observed_title` text NOT NULL,
	`observed_artist` text NOT NULL,
	`observed_album` text NOT NULL,
	`duration_seconds` integer NOT NULL,
	`has_embedded_artwork` integer NOT NULL,
	`artwork_id` text,
	`artwork_mime_type` text,
	`presence` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `library_source`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "track_artwork_pair" CHECK(("track"."artwork_id" IS NULL AND "track"."artwork_mime_type" IS NULL) OR ("track"."artwork_id" IS NOT NULL AND "track"."artwork_mime_type" IS NOT NULL AND "track"."has_embedded_artwork" = 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `track_source_path_unique` ON `track` (`source_id`,`relative_path`);