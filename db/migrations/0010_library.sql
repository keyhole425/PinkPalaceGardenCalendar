CREATE TABLE `library_plant` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`parent_id` integer,
	`common_name` text NOT NULL,
	`scientific_name` text,
	`aliases` text,
	`category` text,
	`lifecycle` text,
	`family` text,
	`days_to_maturity_min` integer,
	`days_to_maturity_max` integer,
	`spacing_cm` integer,
	`row_spacing_cm` integer,
	`summary` text,
	`growing_md` text,
	`care_md` text,
	`harvest_md` text,
	`problems_md` text,
	`citations` text,
	`needs_review` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`source` text DEFAULT 'seed' NOT NULL,
	`source_ref` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`curated_at` text,
	FOREIGN KEY (`parent_id`) REFERENCES `library_plant`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "library_plant_says_what_it_is" CHECK("library_plant"."parent_id" IS NOT NULL OR ("library_plant"."category" IS NOT NULL AND "library_plant"."lifecycle" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_plant_slug_idx` ON `library_plant` (`slug`);--> statement-breakpoint
CREATE INDEX `library_plant_parent_idx` ON `library_plant` (`parent_id`);--> statement-breakpoint
CREATE TABLE `library_region_note` (
	`library_plant_id` integer NOT NULL,
	`region` text NOT NULL,
	`note_md` text NOT NULL,
	`source` text DEFAULT 'seed' NOT NULL,
	`curated_at` text,
	PRIMARY KEY(`library_plant_id`, `region`),
	FOREIGN KEY (`library_plant_id`) REFERENCES `library_plant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `library_rule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`library_plant_id` integer NOT NULL,
	`region` text NOT NULL,
	`action` text NOT NULL,
	`month_mask` integer NOT NULL,
	`cadence` text DEFAULT 'monthly' NOT NULL,
	`alt_group` text,
	`environment_kind` text,
	`label` text,
	`note` text,
	`source` text DEFAULT 'seed' NOT NULL,
	`source_ref` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`curated_at` text,
	FOREIGN KEY (`library_plant_id`) REFERENCES `library_plant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `library_rule_plant_region_idx` ON `library_rule` (`library_plant_id`,`region`);--> statement-breakpoint
ALTER TABLE `household` ADD `region` text DEFAULT 'adelaide' NOT NULL;--> statement-breakpoint
ALTER TABLE `plant_type` ADD `library_plant_id` integer REFERENCES library_plant(id);--> statement-breakpoint
ALTER TABLE `plant_type` ADD `library_revision` integer;--> statement-breakpoint
-- A variety is one level down and no further: a plant and its kinds. A row
-- may point at a parent only if that parent is not itself a variety, and a
-- row that already has varieties cannot become one. Hand-written, like the
-- tenancy triggers; lib/library/library.test.ts fails if they go missing.
CREATE TRIGGER `library_plant_one_level_insert` BEFORE INSERT ON `library_plant`
FOR EACH ROW WHEN NEW.`parent_id` IS NOT NULL
	AND (SELECT `parent_id` FROM `library_plant` WHERE `id` = NEW.`parent_id`) IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'a variety cannot have varieties of its own');
END;
--> statement-breakpoint
CREATE TRIGGER `library_plant_one_level_update` BEFORE UPDATE OF `parent_id` ON `library_plant`
FOR EACH ROW WHEN NEW.`parent_id` IS NOT NULL
	AND (
		NEW.`parent_id` = NEW.`id`
		OR (SELECT `parent_id` FROM `library_plant` WHERE `id` = NEW.`parent_id`) IS NOT NULL
		OR EXISTS (SELECT 1 FROM `library_plant` WHERE `parent_id` = NEW.`id`)
	)
BEGIN
	SELECT RAISE(ABORT, 'a variety cannot have varieties of its own');
END;
