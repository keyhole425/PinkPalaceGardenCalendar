CREATE TABLE `library_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grow_key` text NOT NULL,
	`garden_key` text NOT NULL,
	`library_plant_id` integer NOT NULL,
	`region` text NOT NULL,
	`environment_kind` text NOT NULL,
	`season_year` integer,
	`sow_month` integer,
	`plant_month` integer,
	`days_to_first_harvest` integer,
	`harvest_span_days` integer,
	`picks` integer DEFAULT 0 NOT NULL,
	`outcome` text NOT NULL,
	`notes` text,
	`derived_in` text NOT NULL,
	FOREIGN KEY (`library_plant_id`) REFERENCES `library_plant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_evidence_grow_idx` ON `library_evidence` (`grow_key`);--> statement-breakpoint
CREATE INDEX `library_evidence_plant_idx` ON `library_evidence` (`library_plant_id`);--> statement-breakpoint
CREATE INDEX `library_evidence_garden_idx` ON `library_evidence` (`garden_key`);--> statement-breakpoint
CREATE TABLE `library_suggestion` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`library_plant_id` integer,
	`region` text NOT NULL,
	`garden_key` text NOT NULL,
	`subject_key` text,
	`source_key` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`library_plant_id`) REFERENCES `library_plant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_suggestion_source_idx` ON `library_suggestion` (`source_key`);--> statement-breakpoint
CREATE INDEX `library_suggestion_status_idx` ON `library_suggestion` (`status`);--> statement-breakpoint
ALTER TABLE `household` ADD `share_growing` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `library_plant` ADD `findings_md` text;--> statement-breakpoint
ALTER TABLE `plant_type` ADD `library_change` text;--> statement-breakpoint
ALTER TABLE `plant_type` ADD `library_changed_on` text;