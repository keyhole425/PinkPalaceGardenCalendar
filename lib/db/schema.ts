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
	check,
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const SEED_PROFILES = ['pink-palace', 'starter'] as const;
export type SeedProfile = (typeof SEED_PROFILES)[number];

/**
 * One garden, and everyone who looks after it.
 *
 * Every other table hangs off this. Two households share nothing - not the
 * plants, not the schedule, not what Claude was asked - and a household's id
 * comes from the signed-in person, never from anything a page sends back.
 */
export const household = sqliteTable('household', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	/**
	 * Which seed it grew from. The Pink Palace has its orchard; everyone else
	 * starts from the vegetable catalogue and a bed.
	 */
	seedProfile: text('seed_profile', { enum: SEED_PROFILES })
		.notNull()
		.default('starter'),
	/** The seed version last applied, so a re-seed knows what changed. */
	seedVersion: text('seed_version'),
	createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

/** Where something grows. Environments carry their own climate profile. */
export const environment = sqliteTable(
	'environment',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Whose garden this belongs to. Every read and write is scoped by it. */
		householdId: integer('household_id')
			.notNull()
			.references(() => household.id, { onDelete: 'cascade' }),
		/** Unique within a household; two gardens may both have a bed-1. */
		slug: text('slug').notNull(),
		kind: text('kind', { enum: ['orchard', 'bed', 'hothouse', 'pot'] }).notNull(),
		name: text('name').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),

		widthCm: integer('width_cm'),
		lengthCm: integer('length_cm'),
		/**
		 * How the plan view divides this place up. A bed is a grid of spots you
		 * put things in; the orchard has no grid and is just a list of trees.
		 */
		gridCols: integer('grid_cols'),
		gridRows: integer('grid_rows'),

		/** Never frosts: the hothouse, and anything else fully protected. */
		frostFree: integer('frost_free', { mode: 'boolean' }).notNull().default(false),
		/**
		 * How far ahead of the open garden this environment runs, in whole months.
		 * The hothouse is typically -1: you sow a month earlier inside.
		 */
		windowShiftMonths: integer('window_shift_months').notNull().default(0),
		minTempC: integer('min_temp_c'),
		notes: text('notes'),
	},
	(t) => [uniqueIndex('environment_household_slug_idx').on(t.householdId, t.slug)],
);

/** A kind of plant, not an individual one. The template rules hang off this. */
export const plantType = sqliteTable(
	'plant_type',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Whose garden this belongs to. Every read and write is scoped by it. */
		householdId: integer('household_id')
			.notNull()
			.references(() => household.id, { onDelete: 'cascade' }),
		/** Unique within a household. */
		slug: text('slug').notNull(),
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
	},
	(t) => [uniqueIndex('plant_type_household_slug_idx').on(t.householdId, t.slug)],
);

/** An individual plant in an individual place. */
export const planting = sqliteTable(
	'planting',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Whose garden this belongs to. Every read and write is scoped by it. */
		householdId: integer('household_id')
			.notNull()
			.references(() => household.id, { onDelete: 'cascade' }),
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
		index('planting_household_status_idx').on(t.householdId, t.status),
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
	/** Not a job - an observation logged against a plant. */
	'note',
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
		/** Whose garden this belongs to. Every read and write is scoped by it. */
		householdId: integer('household_id')
			.notNull()
			.references(() => household.id, { onDelete: 'cascade' }),
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
		index('care_rule_household_active_idx').on(t.householdId, t.active),
	],
);

/** What actually happened, and when. */
export const careLog = sqliteTable(
	'care_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Whose garden this belongs to. Every read and write is scoped by it. */
		householdId: integer('household_id')
			.notNull()
			.references(() => household.id, { onDelete: 'cascade' }),
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
		index('care_log_household_completed_idx').on(t.householdId, t.completedOn),
	],
);

/**
 * Something Claude worked out, waiting for a human to agree with it.
 *
 * Nothing here is part of the schedule. A proposal becomes real only when it
 * is accepted, and what gets accepted is whatever the person ticked - which
 * is why the payload is stored whole rather than spread across the care
 * tables.
 */
export const aiProposal = sqliteTable(
	'ai_proposal',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Whose garden this belongs to. Every read and write is scoped by it. */
		householdId: integer('household_id')
			.notNull()
			.references(() => household.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['plant_research'] })
			.notNull()
			.default('plant_research'),
		/** What was asked for, in the person's own words. */
		query: text('query').notNull(),
		/** Set when filling gaps in a plant figgy already knows about. */
		plantTypeId: integer('plant_type_id').references(() => plantType.id, {
			onDelete: 'cascade',
		}),

		/** The structured proposal, as JSON. */
		payload: text('payload'),
		/** Every page consulted, as JSON. Data, never instructions. */
		citations: text('citations'),
		/** The research prose the structured pass was built from. */
		notes: text('notes'),

		model: text('model').notNull(),
		status: text('status', {
			enum: ['running', 'ready', 'accepted', 'rejected', 'failed'],
		})
			.notNull()
			.default('running'),
		error: text('error'),

		createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
		reviewedAt: text('reviewed_at'),
	},
	(t) => [index('ai_proposal_household_status_idx').on(t.householdId, t.status)],
);

/** What each request to the model cost, so spending is visible rather than felt. */
export const aiCall = sqliteTable(
	'ai_call',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Whose garden this belongs to. Every read and write is scoped by it. */
		householdId: integer('household_id')
			.notNull()
			.references(() => household.id, { onDelete: 'cascade' }),

		/** Who asked, so a household can see who spent its key. Gone if they go. */
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		proposalId: integer('proposal_id').references(() => aiProposal.id, {
			onDelete: 'set null',
		}),
		purpose: text('purpose').notNull(),
		model: text('model').notNull(),

		inputTokens: integer('input_tokens').notNull().default(0),
		outputTokens: integer('output_tokens').notNull().default(0),
		cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
		cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
		webSearches: integer('web_searches').notNull().default(0),
		/** Token cost in US cents. Web search fees are not included. */
		costCents: real('cost_cents').notNull().default(0),

		createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
	},
	(t) => [index('ai_call_household_idx').on(t.householdId)],
);

/**
 * Small key/value bag for things that belong to the whole site rather than a
 * garden: the cached forecast, which is Adelaide's for everyone.
 */
export const meta = sqliteTable('meta', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
});

/*
 * People, and how they get in.
 *
 * user, session, account, verification and rate_limit are Better Auth's,
 * shaped the way its Drizzle adapter expects: the property names are its
 * field names, the columns follow figgy's snake_case. Dates here are
 * millisecond timestamps because that is what Better Auth writes; the garden
 * tables keep their YYYY-MM-DD text.
 *
 * There is no sign-up form. An account is only ever made from an invite (see
 * lib/invites.ts), which is why these tables carry nothing about households:
 * that is membership's job.
 */

const createdAt = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`);
const updatedAt = () =>
	integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date());

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	/** Stored lower-cased; Better Auth lower-cases before it looks one up. */
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' })
		.notNull()
		.default(false),
	image: text('image'),
	/**
	 * Can mint invites that start a new garden. Granted and revoked only from
	 * the command line (scripts/admin), never through the app, and read from
	 * the database on every check rather than trusted from a cookie.
	 */
	siteAdmin: integer('site_admin', { mode: 'boolean' }).notNull().default(false),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
	},
	(t) => [index('session_user_idx').on(t.userId)],
);

export const account = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: integer('access_token_expires_at', {
			mode: 'timestamp_ms',
		}),
		refreshTokenExpiresAt: integer('refresh_token_expires_at', {
			mode: 'timestamp_ms',
		}),
		scope: text('scope'),
		/** The password hash, for the 'credential' provider. Never the password. */
		password: text('password'),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [index('account_user_idx').on(t.userId)],
);

export const verification = sqliteTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [index('verification_identifier_idx').on(t.identifier)],
);

/**
 * Login attempts per address, kept in the database because a serverless
 * function's memory is gone by the next request: an in-memory limit would
 * reset every time it mattered.
 */
export const rateLimit = sqliteTable('rate_limit', {
	id: text('id').primaryKey(),
	key: text('key').notNull().unique(),
	count: integer('count').notNull(),
	lastRequest: integer('last_request').notNull(),
});

export const ROLES = ['admin', 'member'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Which garden a person belongs to, and whether they run it. One household
 * per person: the user id is the key.
 *
 * Admins can rename the household, invite people into it, add the AI key,
 * and change or remove other members. Members garden.
 */
export const membership = sqliteTable(
	'membership',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		householdId: integer('household_id')
			.notNull()
			.references(() => household.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ROLES }).notNull().default('member'),
		createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
	},
	(t) => [index('membership_household_idx').on(t.householdId)],
);

export const INVITE_KINDS = [
	'new_household',
	'join_household',
	'reset_password',
] as const;
export type InviteKind = (typeof INVITE_KINDS)[number];

/**
 * A way in, good once.
 *
 * Only a hash of the token is kept, so a copy of the database cannot be
 * turned into working links. `new_household` invites start a garden of their
 * own and only a site admin can make one; `join_household` invites add
 * someone to an existing garden and only its admins can make one;
 * `reset_password` lets one existing person choose a new password, and is
 * how a forgotten one is dealt with in a figgy that sends no email.
 */
export const invite = sqliteTable(
	'invite',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** SHA-256 of the token, hex. The token itself is shown once and kept nowhere. */
		tokenHash: text('token_hash').notNull().unique(),
		kind: text('kind', { enum: INVITE_KINDS }).notNull(),
		/** The garden to join. Null for an invite that starts a new one. */
		householdId: integer('household_id').references(() => household.id, {
			onDelete: 'cascade',
		}),
		role: text('role', { enum: ROLES }).notNull().default('member'),
		/** Whose password a reset invite resets. */
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		/** If set, only this address can use it. */
		email: text('email'),
		/** Null when it was made from the command line. */
		createdByUserId: text('created_by_user_id').references(() => user.id, {
			onDelete: 'set null',
		}),
		createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
		/** ISO instants, compared as text: they sort the way time does. */
		expiresAt: text('expires_at').notNull(),
		usedAt: text('used_at'),
		usedByUserId: text('used_by_user_id').references(() => user.id, {
			onDelete: 'set null',
		}),
		revokedAt: text('revoked_at'),
	},
	(t) => [
		index('invite_household_idx').on(t.householdId),
		check(
			'invite_kind_household',
			sql`(${t.kind} = 'new_household' AND ${t.householdId} IS NULL AND ${t.userId} IS NULL) OR (${t.kind} = 'join_household' AND ${t.householdId} IS NOT NULL AND ${t.userId} IS NULL) OR (${t.kind} = 'reset_password' AND ${t.userId} IS NOT NULL)`,
		),
	],
);

/**
 * A household's own Anthropic key, for the features that ask Claude.
 *
 * Off until an admin adds one: figgy has no key of its own to lend. The key
 * is sealed (lib/crypto/secretbox.ts) against FIGGY_ENCRYPTION_KEY and bound
 * to this household, and only its last four characters ever leave the
 * server. Kept in its own table so that reading a household never so much as
 * fetches the ciphertext.
 */
export const householdAiCredential = sqliteTable('household_ai_credential', {
	householdId: integer('household_id')
		.primaryKey()
		.references(() => household.id, { onDelete: 'cascade' }),
	keySealed: text('key_sealed').notNull(),
	keyLast4: text('key_last4').notNull(),
	/** For an organisation-level key, which workspace to bill. */
	workspaceId: text('workspace_id'),
	updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
	updatedByUserId: text('updated_by_user_id').references(() => user.id, {
		onDelete: 'set null',
	}),
	/** The last time an admin pressed "Check it", and whether it worked. */
	checkedAt: text('checked_at'),
	checkOk: integer('check_ok', { mode: 'boolean' }),
});

export const TOUR_IDS = ['setup', 'basics'] as const;
export type TourId = (typeof TOUR_IDS)[number];
export const TOUR_STATUSES = [
	'pending',
	'in_progress',
	'completed',
	'dismissed',
] as const;

/**
 * How far each person has got through each first-run tour. No row means
 * they have never seen it, which reads as pending: there is nothing to
 * write when an account is made, and someone promoted to admin later meets
 * the setup tour without anyone having to remember to queue it.
 */
export const userTour = sqliteTable(
	'user_tour',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		tourId: text('tour_id', { enum: TOUR_IDS }).notNull(),
		status: text('status', { enum: TOUR_STATUSES }).notNull().default('pending'),
		/** Where they were, so leaving mid-tour picks up at the same step. */
		stepId: text('step_id'),
		updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
	},
	(t) => [primaryKey({ columns: [t.userId, t.tourId] })],
);
