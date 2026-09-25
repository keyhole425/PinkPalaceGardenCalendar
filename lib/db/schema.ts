/**
 * figgy database schema.
 *
 * Two ideas carry most of the weight here:
 *
 *  - A care window is a 12-bit `monthMask` (bit m-1 set means month m). The
 *    orchard spreadsheet this app grew out of has windows that are discrete
 *    ({1,3,9,11}), contiguous (5-8) and year-wrapping ({11,12,1,2}). A mask
 *    handles all three without special cases.
 *
 *  - Mutually exclusive windows ("prune in August OR September") are sibling
 *    rules sharing an `altGroup`. Completing any sibling satisfies the group.
 */
import { sql } from 'drizzle-orm';
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/** Where something grows. Environments carry their own climate profile. */
export const environment = sqliteTable('environment', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	slug: text('slug').notNull().unique(),
	kind: text('kind', { enum: ['orchard', 'bed', 'hothouse', 'pot'] }).notNull(),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),

	widthCm: integer('width_cm'),
	lengthCm: integer('length_cm'),

	/** Never frosts: the hothouse, and anything else fully protected. */
	frostFree: integer('frost_free', { mode: 'boolean' }).notNull().default(false),
	/**
	 * How far ahead of the open garden this environment runs, in whole months.
	 * The hothouse is typically -1: you sow a month earlier inside.
	 */
	windowShiftMonths: integer('window_shift_months').notNull().default(0),
	minTempC: integer('min_temp_c'),
	notes: text('notes'),
});

/** A kind of plant, not an individual one. The template rules hang off this. */
export const plantType = sqliteTable('plant_type', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	slug: text('slug').notNull().unique(),
	commonName: text('common_name').notNull(),
	scientificName: text('scientific_name'),
	category: text('category', {
		enum: ['fruit_tree', 'vegetable', 'herb', 'other'],
	})
		.notNull()
		.default('other'),
	lifecycle: text('lifecycle', {
		enum: ['perennial', 'annual', 'biennial'],
	})
		.notNull()
		.default('perennial'),
	/** Botanical family, for crop rotation warnings. */
	family: text('family'),
	/** Free text, kept verbatim. The orchard notes live here unedited. */
	notesMd: text('notes_md'),

	daysToMaturityMin: integer('days_to_maturity_min'),
	daysToMaturityMax: integer('days_to_maturity_max'),
	spacingCm: integer('spacing_cm'),
	rowSpacingCm: integer('row_spacing_cm'),

	source: text('source', { enum: ['seed', 'user', 'ai'] })
		.notNull()
		.default('user'),
	sourceRef: text('source_ref'),
	/** Set when figgy knows the data is incomplete, so the UI can nag. */
	needsReview: integer('needs_review', { mode: 'boolean' })
		.notNull()
		.default(false),

	createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
	userModifiedAt: text('user_modified_at'),
});

/** An individual plant in an individual place. */
export const planting = sqliteTable(
	'planting',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		plantTypeId: integer('plant_type_id')
			.notNull()
			.references(() => plantType.id, { onDelete: 'cascade' }),
		environmentId: integer('environment_id')
			.notNull()
			.references(() => environment.id, { onDelete: 'restrict' }),
		/** "Cherry #1" - what you call this particular tree. */
		label: text('label').notNull(),
		quantity: integer('quantity').notNull().default(1),

		posX: integer('pos_x'),
		posY: integer('pos_y'),

		// All dates are TEXT 'YYYY-MM-DD'. Never timestamps: see lib/dates.ts.
		plantedOn: text('planted_on'),
		sownOn: text('sown_on'),
		transplantedOn: text('transplanted_on'),
		removedOn: text('removed_on'),

		status: text('status', {
			enum: ['planned', 'active', 'removed', 'dead'],
		})
			.notNull()
			.default('active'),
		notesMd: text('notes_md'),

		createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
	},
	(t) => [
		index('planting_plant_type_idx').on(t.plantTypeId),
		index('planting_environment_idx').on(t.environmentId),
	],
);

export const CARE_ACTIONS = [
	'fertilise',
	'prune',
	'harvest',
	'sow',
	'transplant',
	'thin',
	'net',
	'spray',
	'water',
] as const;
export type CareAction = (typeof CARE_ACTIONS)[number];

export const CADENCES = ['monthly', 'once_in_window', 'continuous'] as const;
export type Cadence = (typeof CADENCES)[number];

/**
 * When an action is due. Attached either to a plant type (the template, which
 * every planting of that type inherits) or to a single planting (an override
 * for one tree that shadows the template).
 */
export const careRule = sqliteTable(
	'care_rule',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		plantTypeId: integer('plant_type_id').references(() => plantType.id, {
			onDelete: 'cascade',
		}),
		plantingId: integer('planting_id').references(() => planting.id, {
			onDelete: 'cascade',
		}),

		action: text('action', { enum: CARE_ACTIONS }).notNull(),
		/** 12-bit window. Bit (m - 1) set means the action applies in month m. */
		monthMask: integer('month_mask').notNull(),
		cadence: text('cadence', { enum: CADENCES }).notNull().default('monthly'),
		/**
		 * Rules sharing an altGroup are alternatives - "August OR September".
		 * Doing any one of them satisfies the whole group for that season.
		 */
		altGroup: text('alt_group'),
		/** Scopes the rule to one kind of environment; null means anywhere. */
		environmentKind: text('environment_kind', {
			enum: ['orchard', 'bed', 'hothouse', 'pot'],
		}),

		label: text('label'),
		note: text('note'),

		source: text('source', { enum: ['seed', 'user', 'ai'] })
			.notNull()
			.default('user'),
		/** Traces a seeded rule back to where it came from. */
		sourceRef: text('source_ref'),
		active: integer('active', { mode: 'boolean' }).notNull().default(true),

		createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
		/** Set the moment a human edits the rule; reseeding then leaves it alone. */
		userModifiedAt: text('user_modified_at'),
	},
	(t) => [
		index('care_rule_plant_type_idx').on(t.plantTypeId),
		index('care_rule_planting_idx').on(t.plantingId),
	],
);

/** What actually happened, and when. */
export const careLog = sqliteTable(
	'care_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		plantingId: integer('planting_id')
			.notNull()
			.references(() => planting.id, { onDelete: 'cascade' }),
		/** Null for an ad-hoc entry that answers no particular rule. */
		careRuleId: integer('care_rule_id').references(() => careRule.id, {
			onDelete: 'set null',
		}),
		action: text('action', { enum: CARE_ACTIONS }).notNull(),
		/**
		 * The year the window opened, so a window running Nov-Feb keys to the
		 * year it started rather than splitting across two.
		 */
		seasonYear: integer('season_year').notNull(),
		/**
		 * Which occurrence of the rule this answers: '2026-09' for a monthly
		 * window, '2026-w8' for a once-a-season one. Null for an ad-hoc entry -
		 * a bucket of figs picked on a whim answers no particular occurrence,
		 * and you can record as many of those as you like.
		 */
		occurrenceKey: text('occurrence_key'),
		completedOn: text('completed_on').notNull(),
		quantityNote: text('quantity_note'),
		notesMd: text('notes_md'),

		createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
	},
	(t) => [
		// One completion per scheduled occurrence. Ad-hoc entries carry no
		// occurrence key and are deliberately left out of the constraint.
		uniqueIndex('care_log_occurrence_idx')
			.on(t.plantingId, t.careRuleId, t.occurrenceKey)
			.where(sql`${t.occurrenceKey} is not null`),
		index('care_log_completed_idx').on(t.completedOn),
	],
);

/** Small key/value bag: seed version, last backup time. */
export const meta = sqliteTable('meta', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
});

export type Environment = typeof environment.$inferSelect;
export type PlantType = typeof plantType.$inferSelect;
export type Planting = typeof planting.$inferSelect;
export type CareRule = typeof careRule.$inferSelect;
export type CareLog = typeof careLog.$inferSelect;
