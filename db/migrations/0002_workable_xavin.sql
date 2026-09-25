CREATE TABLE `ai_call` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
	FOREIGN KEY (`proposal_id`) REFERENCES `ai_proposal`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `ai_proposal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
	FOREIGN KEY (`plant_type_id`) REFERENCES `plant_type`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_proposal_status_idx` ON `ai_proposal` (`status`);