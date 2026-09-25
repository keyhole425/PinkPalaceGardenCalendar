DROP INDEX `care_log_occurrence_idx`;--> statement-breakpoint
ALTER TABLE `care_log` ADD `occurrence_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `care_log_occurrence_idx` ON `care_log` (`planting_id`,`care_rule_id`,`occurrence_key`) WHERE "care_log"."occurrence_key" is not null;