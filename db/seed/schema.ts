/**
 * Shapes the seed files must satisfy. Catching a bad month or a contradictory
 * rule here means it never reaches the database.
 */
import { z } from 'zod';
import {
	CADENCES,
	CARE_ACTIONS,
	ENVIRONMENT_KINDS,
	REGION_IDS,
} from '@/lib/db/schema';

const month = z.number().int().min(1).max(12);

export const seedRuleSchema = z
	.object({
		action: z.enum(CARE_ACTIONS),
		/** A single window, as month numbers. */
		months: z.array(month).min(1).optional(),
		/**
		 * Mutually exclusive windows - "prune in August OR September". Each entry
		 * becomes its own rule, and they share an alt group.
		 */
		anyOf: z.array(z.array(month).min(1)).min(2).optional(),
		cadence: z.enum(CADENCES).default('monthly'),
		note: z.string().optional(),
	})
	.refine((r) => Boolean(r.months) !== Boolean(r.anyOf), {
		message: 'A rule needs either months or anyOf, not both and not neither',
	});

export const seedPlantTypeSchema = z.object({
	slug: z.string().regex(/^[a-z0-9-]+$/),
	commonName: z.string().min(1),
	scientificName: z.string().optional(),
	category: z.enum(['fruit_tree', 'vegetable', 'herb', 'other']),
	lifecycle: z.enum(['perennial', 'annual', 'biennial']),
	family: z.string().optional(),
	/** Kept verbatim from the source. Never tidied up. */
	notesMd: z.string().optional(),
	needsReview: z.boolean().default(false),
	daysToMaturityMin: z.number().int().positive().optional(),
	daysToMaturityMax: z.number().int().positive().optional(),
	spacingCm: z.number().int().positive().optional(),
	/**
	 * One entry per individual plant; the label is what you call that one.
	 * Empty for a crop that is known but not currently in the ground.
	 */
	plantings: z.array(z.string().min(1)).default([]),
	rules: z.array(seedRuleSchema),
});

/**
 * A plant in the library, as the seed writes it.
 *
 * A variety names its `parent` by slug and leaves out whatever it shares with
 * it - see lib/library/resolve.ts. Its rules for an action replace the
 * parent's for that action; an action it gives no rule for is the parent's.
 */
export const seedLibraryPlantSchema = z
	.object({
		slug: z.string().regex(/^[a-z0-9-]+$/),
		parent: z
			.string()
			.regex(/^[a-z0-9-]+$/)
			.optional(),
		commonName: z.string().min(1),
		scientificName: z.string().optional(),
		/** Other names it goes by, so a search finds it under them. */
		aliases: z.array(z.string().min(1)).default([]),
		category: z.enum(['fruit_tree', 'vegetable', 'herb', 'other']).optional(),
		lifecycle: z.enum(['perennial', 'annual', 'biennial']).optional(),
		family: z.string().optional(),
		daysToMaturityMin: z.number().int().positive().optional(),
		daysToMaturityMax: z.number().int().positive().optional(),
		spacingCm: z.number().int().positive().optional(),
		/** The article's opening paragraph. */
		summary: z.string().optional(),
		/** What is worth saying about it in each region. */
		regionNotes: z.partialRecord(z.enum(REGION_IDS), z.string().min(1)).default({}),
		needsReview: z.boolean().default(false),
		/** Windows per region. A variety lists only the actions that differ. */
		rules: z.partialRecord(z.enum(REGION_IDS), z.array(seedRuleSchema)).default({}),
	})
	.refine((p) => p.parent || (p.category && p.lifecycle), {
		message: 'A plant that is not a variety has to say its category and lifecycle',
	});

export type SeedLibraryPlant = z.infer<typeof seedLibraryPlantSchema>;
export type SeedLibraryPlantInput = z.input<typeof seedLibraryPlantSchema>;

export const seedEnvironmentSchema = z.object({
	slug: z.string().regex(/^[a-z0-9-]+$/),
	kind: z.enum(ENVIRONMENT_KINDS),
	name: z.string().min(1),
	sortOrder: z.number().int().default(0),
	frostFree: z.boolean().default(false),
	windowShiftMonths: z.number().int().min(-6).max(6).default(0),
	widthCm: z.number().int().positive().optional(),
	lengthCm: z.number().int().positive().optional(),
	gridCols: z.number().int().min(1).max(12).optional(),
	gridRows: z.number().int().min(1).max(12).optional(),
	notes: z.string().optional(),
});

export type SeedPlantType = z.infer<typeof seedPlantTypeSchema>;

/**
 * What the seed files themselves are written as: defaults may be left out,
 * because parsing is what fills them in.
 */
export type SeedPlantTypeInput = z.input<typeof seedPlantTypeSchema>;
export type SeedEnvironmentInput = z.input<typeof seedEnvironmentSchema>;
