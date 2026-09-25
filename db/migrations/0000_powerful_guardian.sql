CREATE TABLE `care_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`planting_id` integer NOT NULL,
	`care_rule_id` integer,
	`action` text NOT NULL,
	`season_year` integer NOT NULL,
	`completed_on` text NOT NULL,
	`quantity_note` text,
	`notes_md` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`planting_id`) REFERENCES `planting`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`care_rule_id`) REFERENCES `care_rule`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `care_log_occurrence_idx` ON `care_log` (`planting_id`,`care_rule_id`,`season_year`);--> statement-breakpoint
CREATE INDEX `care_log_completed_idx` ON `care_log` (`completed_on`);--> statement-breakpoint
CREATE TABLE `care_rule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plant_type_id` integer,
	`planting_id` integer,
	`action` text NOT NULL,
	`month_mask` integer NOT NULL,
	`cadence` text DEFAULT 'monthly' NOT NULL,
	`alt_group` text,
	`environment_kind` text,
	`label` text,
	`note` text,
	`source` text DEFAULT 'user' NOT NULL,
	`source_ref` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`user_modified_at` text,
	FOREIGN KEY (`plant_type_id`) REFERENCES `plant_type`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planting_id`) REFERENCES `planting`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `care_rule_plant_type_idx` ON `care_rule` (`plant_type_id`);--> statement-breakpoint
CREATE INDEX `care_rule_planting_idx` ON `care_rule` (`planting_id`);--> statement-breakpoint
CREATE TABLE `environment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`width_cm` integer,
	`length_cm` integer,
	`frost_free` integer DEFAULT false NOT NULL,
	`window_shift_months` integer DEFAULT 0 NOT NULL,
	`min_temp_c` integer,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `environment_slug_unique` ON `environment` (`slug`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plant_type` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`common_name` text NOT NULL,
	`scientific_name` text,
	`category` text DEFAULT 'other' NOT NULL,
	`lifecycle` text DEFAULT 'perennial' NOT NULL,
	`family` text,
	`notes_md` text,
	`days_to_maturity_min` integer,
	`days_to_maturity_max` integer,
	`spacing_cm` integer,
	`row_spacing_cm` integer,
	`source` text DEFAULT 'user' NOT NULL,
	`source_ref` text,
	`needs_review` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`user_modified_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plant_type_slug_unique` ON `plant_type` (`slug`);--> statement-breakpoint
CREATE TABLE `planting` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plant_type_id` integer NOT NULL,
	`environment_id` integer NOT NULL,
	`label` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`pos_x` integer,
	`pos_y` integer,
	`planted_on` text,
	`sown_on` text,
	`transplanted_on` text,
	`removed_on` text,
	`status` text DEFAULT 'active' NOT NULL,
	`notes_md` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`plant_type_id`) REFERENCES `plant_type`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `environment`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `planting_plant_type_idx` ON `planting` (`plant_type_id`);--> statement-breakpoint
CREATE INDEX `planting_environment_idx` ON `planting` (`environment_id`);