-- Households: every row now belongs to one garden.
--
-- Hand-written. drizzle-kit generated ADD COLUMN ... NOT NULL with no default,
-- which SQLite refuses, so each table is rebuilt instead. libSQL's migrate()
-- runs this with foreign keys off, which is what makes dropping a parent table
-- safe: with them on, DROP TABLE plant_type would cascade-delete every
-- planting.
--
-- Everything that already exists is the Pink Palace's, and becomes household
-- 1. A database with nothing in it gets no household at all; the first one is
-- made when somebody signs up.
CREATE TABLE `household` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`seed_profile` text DEFAULT 'starter' NOT NULL,
	`seed_version` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `household` (`id`, `name`, `seed_profile`, `seed_version`)
SELECT 1, 'Pink Palace', 'pink-palace', (SELECT `value` FROM `meta` WHERE `key` = 'seed_version')
WHERE EXISTS (SELECT 1 FROM `plant_type`) OR EXISTS (SELECT 1 FROM `environment`);
--> statement-breakpoint
CREATE TABLE `__new_environment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`slug` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`width_cm` integer,
	`length_cm` integer,
	`grid_cols` integer,
	`grid_rows` integer,
	`frost_free` integer DEFAULT false NOT NULL,
	`window_shift_months` integer DEFAULT 0 NOT NULL,
	`min_temp_c` integer,
	`notes` text,
	FOREIGN KEY (`household_id`) REFERENCES `household`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_environment` (`id`, `slug`, `kind`, `name`, `sort_order`, `width_cm`, `length_cm`, `grid_cols`, `grid_rows`, `frost_free`, `window_shift_months`, `min_temp_c`, `notes`, `household_id`) SELECT `id`, `slug`, `kind`, `name`, `sort_order`, `width_cm`, `length_cm`, `grid_cols`, `grid_rows`, `frost_free`, `window_shift_months`, `min_temp_c`, `notes`, 1 FROM `environment`;
--> statement-breakpoint
DROP TABLE `environment`;
--> statement-breakpoint
ALTER TABLE `__new_environment` RENAME TO `environment`;
--> statement-breakpoint
CREATE UNIQUE INDEX `environment_household_slug_idx` ON `environment` (`household_id`,`slug`);
--> statement-breakpoint
CREATE TABLE `__new_plant_type` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
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
	`user_modified_at` text,
	FOREIGN KEY (`household_id`) REFERENCES `household`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_plant_type` (`id`, `slug`, `common_name`, `scientific_name`, `category`, `lifecycle`, `family`, `notes_md`, `days_to_maturity_min`, `days_to_maturity_max`, `spacing_cm`, `row_spacing_cm`, `source`, `source_ref`, `needs_review`, `created_at`, `user_modified_at`, `household_id`) SELECT `id`, `slug`, `common_name`, `scientific_name`, `category`, `lifecycle`, `family`, `notes_md`, `days_to_maturity_min`, `days_to_maturity_max`, `spacing_cm`, `row_spacing_cm`, `source`, `source_ref`, `needs_review`, `created_at`, `user_modified_at`, 1 FROM `plant_type`;
--> statement-breakpoint
DROP TABLE `plant_type`;
--> statement-breakpoint
ALTER TABLE `__new_plant_type` RENAME TO `plant_type`;
--> statement-breakpoint
CREATE UNIQUE INDEX `plant_type_household_slug_idx` ON `plant_type` (`household_id`,`slug`);
--> statement-breakpoint
CREATE TABLE `__new_planting` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
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
	FOREIGN KEY (`household_id`) REFERENCES `household`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plant_type_id`) REFERENCES `plant_type`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `environment`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_planting` (`id`, `plant_type_id`, `environment_id`, `label`, `quantity`, `pos_x`, `pos_y`, `planted_on`, `sown_on`, `transplanted_on`, `removed_on`, `status`, `notes_md`, `created_at`, `household_id`) SELECT `id`, `plant_type_id`, `environment_id`, `label`, `quantity`, `pos_x`, `pos_y`, `planted_on`, `sown_on`, `transplanted_on`, `removed_on`, `status`, `notes_md`, `created_at`, 1 FROM `planting`;
--> statement-breakpoint
DROP TABLE `planting`;
--> statement-breakpoint
ALTER TABLE `__new_planting` RENAME TO `planting`;
--> statement-breakpoint
CREATE INDEX `planting_plant_type_idx` ON `planting` (`plant_type_id`);
--> statement-breakpoint
CREATE INDEX `planting_environment_idx` ON `planting` (`environment_id`);
--> statement-breakpoint
CREATE INDEX `planting_household_status_idx` ON `planting` (`household_id`,`status`);
--> statement-breakpoint
CREATE TABLE `__new_care_rule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
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
	FOREIGN KEY (`household_id`) REFERENCES `household`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plant_type_id`) REFERENCES `plant_type`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planting_id`) REFERENCES `planting`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_care_rule` (`id`, `plant_type_id`, `planting_id`, `action`, `month_mask`, `cadence`, `alt_group`, `environment_kind`, `label`, `note`, `source`, `source_ref`, `active`, `created_at`, `user_modified_at`, `household_id`) SELECT `id`, `plant_type_id`, `planting_id`, `action`, `month_mask`, `cadence`, `alt_group`, `environment_kind`, `label`, `note`, `source`, `source_ref`, `active`, `created_at`, `user_modified_at`, 1 FROM `care_rule`;
--> statement-breakpoint
DROP TABLE `care_rule`;
--> statement-breakpoint
ALTER TABLE `__new_care_rule` RENAME TO `care_rule`;
--> statement-breakpoint
CREATE INDEX `care_rule_plant_type_idx` ON `care_rule` (`plant_type_id`);
--> statement-breakpoint
CREATE INDEX `care_rule_planting_idx` ON `care_rule` (`planting_id`);
--> statement-breakpoint
CREATE INDEX `care_rule_household_active_idx` ON `care_rule` (`household_id`,`active`);
--> statement-breakpoint
CREATE TABLE `__new_care_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`planting_id` integer NOT NULL,
	`care_rule_id` integer,
	`action` text NOT NULL,
	`season_year` integer NOT NULL,
	`occurrence_key` text,
	`completed_on` text NOT NULL,
	`quantity_note` text,
	`notes_md` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `household`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planting_id`) REFERENCES `planting`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`care_rule_id`) REFERENCES `care_rule`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_care_log` (`id`, `planting_id`, `care_rule_id`, `action`, `season_year`, `occurrence_key`, `completed_on`, `quantity_note`, `notes_md`, `created_at`, `household_id`) SELECT `id`, `planting_id`, `care_rule_id`, `action`, `season_year`, `occurrence_key`, `completed_on`, `quantity_note`, `notes_md`, `created_at`, 1 FROM `care_log`;
--> statement-breakpoint
DROP TABLE `care_log`;
--> statement-breakpoint
ALTER TABLE `__new_care_log` RENAME TO `care_log`;
--> statement-breakpoint
CREATE UNIQUE INDEX `care_log_occurrence_idx` ON `care_log` (`planting_id`,`care_rule_id`,`occurrence_key`) WHERE "care_log"."occurrence_key" is not null;
--> statement-breakpoint
CREATE INDEX `care_log_household_completed_idx` ON `care_log` (`household_id`,`completed_on`);
--> statement-breakpoint
CREATE TABLE `__new_ai_proposal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`kind` text DEFAULT 'plant_research' NOT NULL,
	`query` text NOT NULL,
	`plant_type_id` integer,
	`payload` text,
	`citations` text,
	`notes` text,
	`model` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`error` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`household_id`) REFERENCES `household`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plant_type_id`) REFERENCES `plant_type`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ai_proposal` (`id`, `kind`, `query`, `plant_type_id`, `payload`, `citations`, `notes`, `model`, `status`, `error`, `created_at`, `reviewed_at`, `household_id`) SELECT `id`, `kind`, `query`, `plant_type_id`, `payload`, `citations`, `notes`, `model`, `status`, `error`, `created_at`, `reviewed_at`, 1 FROM `ai_proposal`;
--> statement-breakpoint
DROP TABLE `ai_proposal`;
--> statement-breakpoint
ALTER TABLE `__new_ai_proposal` RENAME TO `ai_proposal`;
--> statement-breakpoint
CREATE INDEX `ai_proposal_household_status_idx` ON `ai_proposal` (`household_id`,`status`);
--> statement-breakpoint
CREATE TABLE `__new_ai_call` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`proposal_id` integer,
	`purpose` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cache_read_tokens` integer DEFAULT 0 NOT NULL,
	`cache_write_tokens` integer DEFAULT 0 NOT NULL,
	`web_searches` integer DEFAULT 0 NOT NULL,
	`cost_cents` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `household`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposal_id`) REFERENCES `ai_proposal`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_ai_call` (`id`, `proposal_id`, `purpose`, `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `web_searches`, `cost_cents`, `created_at`, `household_id`) SELECT `id`, `proposal_id`, `purpose`, `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `web_searches`, `cost_cents`, `created_at`, 1 FROM `ai_call`;
--> statement-breakpoint
DROP TABLE `ai_call`;
--> statement-breakpoint
ALTER TABLE `__new_ai_call` RENAME TO `ai_call`;
--> statement-breakpoint
CREATE INDEX `ai_call_household_idx` ON `ai_call` (`household_id`);
--> statement-breakpoint
-- The seed version lives on the household now, the backup job is gone, and
-- the forecast cache moved to weather.v2 long ago.
DELETE FROM `meta` WHERE `key` IN ('seed_version', 'last_backup_at', 'weather');
