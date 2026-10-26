CREATE TABLE `user_tour` (
	`user_id` text NOT NULL,
	`tour_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`step_id` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`user_id`, `tour_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
