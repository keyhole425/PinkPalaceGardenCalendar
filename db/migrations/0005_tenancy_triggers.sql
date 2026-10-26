-- Tenancy, enforced by the database as well as the code.
--
-- Every row carries a household_id, and anything it points at has to carry
-- the same one. The code scopes every query by household; these triggers are
-- the second lock, so that a forgotten filter in an action cannot plant one
-- garden's tree in another garden's bed. Triggers rather than composite
-- foreign keys because they hold whether or not a connection enforces
-- foreign keys at all.
--
-- A row's household never changes once written.
--
-- drizzle-kit drops these whenever it rebuilds one of these tables. A test
-- (lib/db/tenancy.test.ts) fails if any of them goes missing.
CREATE TRIGGER `environment_household_insert` BEFORE INSERT ON `environment`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in environment');
END;
--> statement-breakpoint
CREATE TRIGGER `environment_household_update` BEFORE UPDATE ON `environment`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in environment');
END;
--> statement-breakpoint
CREATE TRIGGER `environment_household_fixed` BEFORE UPDATE OF `household_id` ON `environment`
FOR EACH ROW WHEN NEW.`household_id` IS NOT OLD.`household_id`
BEGIN
	SELECT RAISE(ABORT, 'a row cannot move to another household');
END;
--> statement-breakpoint
CREATE TRIGGER `plant_type_household_insert` BEFORE INSERT ON `plant_type`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in plant_type');
END;
--> statement-breakpoint
CREATE TRIGGER `plant_type_household_update` BEFORE UPDATE ON `plant_type`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in plant_type');
END;
--> statement-breakpoint
CREATE TRIGGER `plant_type_household_fixed` BEFORE UPDATE OF `household_id` ON `plant_type`
FOR EACH ROW WHEN NEW.`household_id` IS NOT OLD.`household_id`
BEGIN
	SELECT RAISE(ABORT, 'a row cannot move to another household');
END;
--> statement-breakpoint
CREATE TRIGGER `planting_household_insert` BEFORE INSERT ON `planting`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
	OR (SELECT `household_id` FROM `plant_type` WHERE `id` = NEW.`plant_type_id`) IS NOT NEW.`household_id`
	OR (SELECT `household_id` FROM `environment` WHERE `id` = NEW.`environment_id`) IS NOT NEW.`household_id`
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in planting');
END;
--> statement-breakpoint
CREATE TRIGGER `planting_household_update` BEFORE UPDATE ON `planting`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
	OR (SELECT `household_id` FROM `plant_type` WHERE `id` = NEW.`plant_type_id`) IS NOT NEW.`household_id`
	OR (SELECT `household_id` FROM `environment` WHERE `id` = NEW.`environment_id`) IS NOT NEW.`household_id`
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in planting');
END;
--> statement-breakpoint
CREATE TRIGGER `planting_household_fixed` BEFORE UPDATE OF `household_id` ON `planting`
FOR EACH ROW WHEN NEW.`household_id` IS NOT OLD.`household_id`
BEGIN
	SELECT RAISE(ABORT, 'a row cannot move to another household');
END;
--> statement-breakpoint
CREATE TRIGGER `care_rule_household_insert` BEFORE INSERT ON `care_rule`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
	OR (NEW.`plant_type_id` IS NOT NULL AND (SELECT `household_id` FROM `plant_type` WHERE `id` = NEW.`plant_type_id`) IS NOT NEW.`household_id`)
	OR (NEW.`planting_id` IS NOT NULL AND (SELECT `household_id` FROM `planting` WHERE `id` = NEW.`planting_id`) IS NOT NEW.`household_id`)
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in care_rule');
END;
--> statement-breakpoint
CREATE TRIGGER `care_rule_household_update` BEFORE UPDATE ON `care_rule`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
	OR (NEW.`plant_type_id` IS NOT NULL AND (SELECT `household_id` FROM `plant_type` WHERE `id` = NEW.`plant_type_id`) IS NOT NEW.`household_id`)
	OR (NEW.`planting_id` IS NOT NULL AND (SELECT `household_id` FROM `planting` WHERE `id` = NEW.`planting_id`) IS NOT NEW.`household_id`)
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in care_rule');
END;
--> statement-breakpoint
CREATE TRIGGER `care_rule_household_fixed` BEFORE UPDATE OF `household_id` ON `care_rule`
FOR EACH ROW WHEN NEW.`household_id` IS NOT OLD.`household_id`
BEGIN
	SELECT RAISE(ABORT, 'a row cannot move to another household');
END;
--> statement-breakpoint
CREATE TRIGGER `care_log_household_insert` BEFORE INSERT ON `care_log`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
	OR (SELECT `household_id` FROM `planting` WHERE `id` = NEW.`planting_id`) IS NOT NEW.`household_id`
	OR (NEW.`care_rule_id` IS NOT NULL AND (SELECT `household_id` FROM `care_rule` WHERE `id` = NEW.`care_rule_id`) IS NOT NEW.`household_id`)
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in care_log');
END;
--> statement-breakpoint
CREATE TRIGGER `care_log_household_update` BEFORE UPDATE ON `care_log`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
	OR (SELECT `household_id` FROM `planting` WHERE `id` = NEW.`planting_id`) IS NOT NEW.`household_id`
	OR (NEW.`care_rule_id` IS NOT NULL AND (SELECT `household_id` FROM `care_rule` WHERE `id` = NEW.`care_rule_id`) IS NOT NEW.`household_id`)
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in care_log');
END;
--> statement-breakpoint
CREATE TRIGGER `care_log_household_fixed` BEFORE UPDATE OF `household_id` ON `care_log`
FOR EACH ROW WHEN NEW.`household_id` IS NOT OLD.`household_id`
BEGIN
	SELECT RAISE(ABORT, 'a row cannot move to another household');
END;
--> statement-breakpoint
CREATE TRIGGER `ai_proposal_household_insert` BEFORE INSERT ON `ai_proposal`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
	OR (NEW.`plant_type_id` IS NOT NULL AND (SELECT `household_id` FROM `plant_type` WHERE `id` = NEW.`plant_type_id`) IS NOT NEW.`household_id`)
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in ai_proposal');
END;
--> statement-breakpoint
CREATE TRIGGER `ai_proposal_household_update` BEFORE UPDATE ON `ai_proposal`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
	OR (NEW.`plant_type_id` IS NOT NULL AND (SELECT `household_id` FROM `plant_type` WHERE `id` = NEW.`plant_type_id`) IS NOT NEW.`household_id`)
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in ai_proposal');
END;
--> statement-breakpoint
CREATE TRIGGER `ai_proposal_household_fixed` BEFORE UPDATE OF `household_id` ON `ai_proposal`
FOR EACH ROW WHEN NEW.`household_id` IS NOT OLD.`household_id`
BEGIN
	SELECT RAISE(ABORT, 'a row cannot move to another household');
END;
--> statement-breakpoint
CREATE TRIGGER `ai_call_household_insert` BEFORE INSERT ON `ai_call`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
	OR (NEW.`proposal_id` IS NOT NULL AND (SELECT `household_id` FROM `ai_proposal` WHERE `id` = NEW.`proposal_id`) IS NOT NEW.`household_id`)
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in ai_call');
END;
--> statement-breakpoint
CREATE TRIGGER `ai_call_household_update` BEFORE UPDATE ON `ai_call`
FOR EACH ROW WHEN (SELECT `id` FROM `household` WHERE `id` = NEW.`household_id`) IS NULL
	OR (NEW.`proposal_id` IS NOT NULL AND (SELECT `household_id` FROM `ai_proposal` WHERE `id` = NEW.`proposal_id`) IS NOT NEW.`household_id`)
BEGIN
	SELECT RAISE(ABORT, 'cross-household reference in ai_call');
END;
--> statement-breakpoint
CREATE TRIGGER `ai_call_household_fixed` BEFORE UPDATE OF `household_id` ON `ai_call`
FOR EACH ROW WHEN NEW.`household_id` IS NOT OLD.`household_id`
BEGIN
	SELECT RAISE(ABORT, 'a row cannot move to another household');
END;
