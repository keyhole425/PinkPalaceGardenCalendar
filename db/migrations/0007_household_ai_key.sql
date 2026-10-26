CREATE TABLE `household_ai_credential` (
	`household_id` integer PRIMARY KEY NOT NULL,
	`key_sealed` text NOT NULL,
	`key_last4` text NOT NULL,
	`workspace_id` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_by_user_id` text,
	`checked_at` text,
	`check_ok` integer,
	FOREIGN KEY (`household_id`) REFERENCES `household`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
