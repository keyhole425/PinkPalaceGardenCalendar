/**
 * Seeding a household's garden. Safe to re-run at any time.
 *
 * Each household grew from a profile. The Pink Palace has its orchard - the
 * spreadsheet this app began as - plus the beds and the hothouse. Every other
 * household starts from the vegetable catalogue and one bed, and makes the
 * rest its own.
 *
 * The rule that makes it safe: seeding only ever touches what it still owns.
 * A rule is the seed's while `source = 'seed'` and nobody has edited it. The
 * moment you change a plant's pruning in the app, pruning becomes yours -
 * the seed stops deleting it *and* stops writing its own version back, so
 * re-running never resurrects what you replaced or leaves you with two of
 * everything.
 */
import { and, asc, eq, isNotNull, isNull, ne, or } from 'drizzle-orm';
import type { Db, Tx } from '@/lib/db/client';
import { deleteRules } from '@/lib/db/rules';
import {
	careRule,
	environment,
	household,
	planting,
	plantType,
	type SeedProfile,
} from '@/lib/db/schema';
import { asHouseholdId, type HouseholdId, owns } from '@/lib/db/tenancy';
import { maskFromMonths } from '@/lib/schedule/months';
import {
	environments as orchardEnvironments,
	plantTypes as orchardPlantTypes,
	SEED_SOURCE,
	SEED_VERSION,
} from './orchard';
import {
	type SeedEnvironmentInput,
	type SeedPlantType,
	type SeedPlantTypeInput,
	seedEnvironmentSchema,
	seedPlantTypeSchema,
} from './schema';
import { vegEnvironments, vegPlantTypes } from './veg';

export type SeedReport = {
	householdId: HouseholdId;
	version: string;
	environments: number;
	plantTypes: number;
	plantings: number;
	rules: number;
	leftAlone: string[];
};

type Profile = {
	environments: SeedEnvironmentInput[];
	plantTypes: SeedPlantTypeInput[];
	/** Where the profile's own plantings go, if it has any. */
	plantingsIn: string | null;
};

const PROFILES: Record<SeedProfile, Profile> = {
	'pink-palace': {
		environments: [...orchardEnvironments, ...vegEnvironments],
		plantTypes: [...orchardPlantTypes, ...vegPlantTypes],
		plantingsIn: 'orchard',
	},
	starter: {
		environments: vegEnvironments.filter((e) => e.slug === 'bed-1'),
		plantTypes: vegPlantTypes,
		plantingsIn: null,
	},
};

async function seedEnvironments(db: Db, hid: HouseholdId, profile: Profile) {
	let created = 0;
	for (const raw of profile.environments) {
		const env = seedEnvironmentSchema.parse(raw);
		const existing = await db
			.select({ id: environment.id })
			.from(environment)
			.where(and(owns(environment, hid), eq(environment.slug, env.slug)))
			.get();

		if (existing) {
			await db
				.update(environment)
				.set({
					kind: env.kind,
					name: env.name,
					sortOrder: env.sortOrder,
					frostFree: env.frostFree,
					windowShiftMonths: env.windowShiftMonths,
					widthCm: env.widthCm,
					lengthCm: env.lengthCm,
					gridCols: env.gridCols,
					gridRows: env.gridRows,
					notes: env.notes,
				})
				.where(eq(environment.id, existing.id))
				.run();
		} else {
			await db
				.insert(environment)
				.values({ ...env, householdId: hid })
				.run();
			created++;
		}
	}
	return created;
}

/**
 * Which actions a person has taken charge of for this plant.
 *
 * Anything not written by the seed, or written by the seed and since edited,
 * counts - including a tombstone, the disabled row left behind when a rule is
 * deleted, which is how "this tree needs no pruning" survives a re-seed.
 */
async function userOwnedActions(
	db: Db,
	hid: HouseholdId,
	plantTypeId: number,
): Promise<Set<string>> {
	const rows = await db
		.select({ action: careRule.action })
		.from(careRule)
		.where(
			and(
				owns(careRule, hid),
				eq(careRule.plantTypeId, plantTypeId),
				or(ne(careRule.source, 'seed'), isNotNull(careRule.userModifiedAt)),
			),
		)
		.all();
	return new Set(rows.map((r) => r.action));
}

/** The rows a seed rule becomes: one, or one per alternative month set. */
function ruleRows(
	hid: HouseholdId,
	plantTypeId: number,
	pt: SeedPlantType,
): (typeof careRule.$inferInsert)[] {
	return pt.rules.flatMap((rule): (typeof careRule.$inferInsert)[] => {
		const sourceRef = `${SEED_SOURCE} / ${pt.commonName} / ${rule.action}`;
		const common = {
			householdId: hid,
			plantTypeId,
			action: rule.action,
			cadence: rule.cadence,
			note: rule.note,
			source: 'seed' as const,
			sourceRef,
		};
		if (rule.months) {
			return [
				{ ...common, monthMask: maskFromMonths(rule.months), altGroup: null },
			];
		}
		// Alternatives: one rule per option, tied together by a shared group.
		const altGroup = `${pt.slug}:${rule.action}`;
		return (rule.anyOf ?? []).map((option) => ({
			...common,
			monthMask: maskFromMonths(option),
			altGroup,
		}));
	});
}

async function seedRulesFor(
	db: Db,
	hid: HouseholdId,
	plantTypeId: number,
	pt: SeedPlantType,
) {
	const owned = await userOwnedActions(db, hid, plantTypeId);

	// Clear out only the rules this seed still owns, then lay them down fresh.
	await deleteRules(
		db,
		and(
			owns(careRule, hid),
			eq(careRule.plantTypeId, plantTypeId),
			eq(careRule.source, 'seed'),
			isNull(careRule.userModifiedAt),
		),
	);

	const rows = ruleRows(hid, plantTypeId, pt).filter((r) => !owned.has(r.action));
	if (rows.length > 0) await db.insert(careRule).values(rows).run();
	return { written: rows.length, owned: [...owned] };
}

async function seedPlantingsFor(
	db: Db,
	hid: HouseholdId,
	plantTypeId: number,
	pt: SeedPlantType,
	environmentId: number,
) {
	let created = 0;
	for (const label of pt.plantings) {
		const existing = await db
			.select({ id: planting.id })
			.from(planting)
			.where(
				and(
					owns(planting, hid),
					eq(planting.plantTypeId, plantTypeId),
					eq(planting.label, label),
				),
			)
			.get();
		if (existing) continue;

		await db
			.insert(planting)
			.values({
				householdId: hid,
				plantTypeId,
				environmentId,
				label,
				status: 'active',
			})
			.run();
		created++;
	}
	return created;
}

/**
 * Brings one household up to date with its profile, leaving alone everything
 * its people have made their own.
 */
export async function seedHousehold(
	db: Db,
	hid: HouseholdId,
	profileName: SeedProfile,
): Promise<SeedReport> {
	const profile = PROFILES[profileName];
	const newEnvironments = await seedEnvironments(db, hid, profile);

	const home = profile.plantingsIn
		? await db
				.select({ id: environment.id })
				.from(environment)
				.where(
					and(owns(environment, hid), eq(environment.slug, profile.plantingsIn)),
				)
				.get()
		: undefined;
	if (profile.plantingsIn && !home) {
		throw new Error(
			`The ${profile.plantingsIn} environment is missing after seeding.`,
		);
	}

	const report: SeedReport = {
		householdId: hid,
		version: SEED_VERSION,
		environments: newEnvironments,
		plantTypes: 0,
		plantings: 0,
		rules: 0,
		leftAlone: [],
	};

	for (const raw of profile.plantTypes) {
		const pt = seedPlantTypeSchema.parse(raw);
		const fields = {
			commonName: pt.commonName,
			scientificName: pt.scientificName,
			category: pt.category,
			lifecycle: pt.lifecycle,
			family: pt.family,
			notesMd: pt.notesMd,
			needsReview: pt.needsReview,
			daysToMaturityMin: pt.daysToMaturityMin,
			daysToMaturityMax: pt.daysToMaturityMax,
			spacingCm: pt.spacingCm,
			source: 'seed' as const,
			sourceRef: pt.category === 'fruit_tree' ? SEED_SOURCE : 'Starter set',
		};

		const existing = await db
			.select({ id: plantType.id, userModifiedAt: plantType.userModifiedAt })
			.from(plantType)
			.where(and(owns(plantType, hid), eq(plantType.slug, pt.slug)))
			.get();

		let plantTypeId: number;
		if (!existing) {
			plantTypeId = (
				await db
					.insert(plantType)
					.values({ householdId: hid, slug: pt.slug, ...fields })
					.returning({ id: plantType.id })
					.get()
			).id;
			report.plantTypes++;
		} else {
			plantTypeId = existing.id;
			if (existing.userModifiedAt) {
				report.leftAlone.push(pt.slug);
			} else {
				await db
					.update(plantType)
					.set(fields)
					.where(and(owns(plantType, hid), eq(plantType.id, plantTypeId)))
					.run();
			}
		}

		const rules = await seedRulesFor(db, hid, plantTypeId, pt);
		report.rules += rules.written;
		for (const action of rules.owned) {
			report.leftAlone.push(`${pt.slug}:${action}`);
		}

		if (home) {
			report.plantings += await seedPlantingsFor(db, hid, plantTypeId, pt, home.id);
		}
	}

	await db
		.update(household)
		.set({ seedVersion: SEED_VERSION })
		.where(eq(household.id, hid))
		.run();

	return report;
}

/**
 * A brand-new household, filled in a handful of statements.
 *
 * Nothing exists yet, so there is nothing to leave alone and no reason to ask
 * the database about each plant in turn - which matters because this runs
 * inside the sign-up transaction, and a hosted database holds the write lock
 * for as long as that takes. A test holds it to the same result as
 * seedHousehold.
 */
export async function createSeededHousehold(
	tx: Db | Tx,
	name: string,
	profileName: SeedProfile,
): Promise<HouseholdId> {
	const profile = PROFILES[profileName];
	const created = await tx
		.insert(household)
		.values({ name, seedProfile: profileName, seedVersion: SEED_VERSION })
		.returning({ id: household.id })
		.get();
	const hid = asHouseholdId(created.id);

	const environments = profile.environments.map((raw) => ({
		...seedEnvironmentSchema.parse(raw),
		householdId: hid,
	}));
	const places = await tx
		.insert(environment)
		.values(environments)
		.returning({ id: environment.id, slug: environment.slug })
		.all();

	const parsed = profile.plantTypes.map((raw) => seedPlantTypeSchema.parse(raw));
	const types = await tx
		.insert(plantType)
		.values(
			parsed.map((pt) => ({
				householdId: hid,
				slug: pt.slug,
				commonName: pt.commonName,
				scientificName: pt.scientificName,
				category: pt.category,
				lifecycle: pt.lifecycle,
				family: pt.family,
				notesMd: pt.notesMd,
				needsReview: pt.needsReview,
				daysToMaturityMin: pt.daysToMaturityMin,
				daysToMaturityMax: pt.daysToMaturityMax,
				spacingCm: pt.spacingCm,
				source: 'seed' as const,
				sourceRef: pt.category === 'fruit_tree' ? SEED_SOURCE : 'Starter set',
			})),
		)
		.returning({ id: plantType.id, slug: plantType.slug })
		.all();
	const idOf = new Map(types.map((t) => [t.slug, t.id]));

	const rules = parsed.flatMap((pt) => ruleRows(hid, idOf.get(pt.slug)!, pt));
	if (rules.length > 0) await tx.insert(careRule).values(rules).run();

	const home = places.find((p) => p.slug === profile.plantingsIn);
	const plantings = home
		? parsed.flatMap((pt) =>
				pt.plantings.map((label) => ({
					householdId: hid,
					plantTypeId: idOf.get(pt.slug)!,
					environmentId: home.id,
					label,
					status: 'active' as const,
				})),
			)
		: [];
	if (plantings.length > 0) await tx.insert(planting).values(plantings).run();

	return hid;
}

/**
 * The Pink Palace, for development and the tests: found if it exists, made if
 * it does not, then brought up to date.
 */
export async function seedGarden(db: Db): Promise<SeedReport> {
	const existing = await db
		.select({ id: household.id })
		.from(household)
		.where(eq(household.seedProfile, 'pink-palace'))
		.orderBy(asc(household.id))
		.get();
	const hid = existing
		? asHouseholdId(existing.id)
		: asHouseholdId(
				(
					await db
						.insert(household)
						.values({ name: 'Pink Palace', seedProfile: 'pink-palace' })
						.returning({ id: household.id })
						.get()
				).id,
			);
	return seedHousehold(db, hid, 'pink-palace');
}

/** Every household, each from its own profile. What `npm run db:seed` runs. */
export async function seedAll(db: Db): Promise<SeedReport[]> {
	const households = await db
		.select({ id: household.id, profile: household.seedProfile })
		.from(household)
		.orderBy(asc(household.id))
		.all();
	// An empty database is a development one: give it the Pink Palace, so
	// there is a garden to look at.
	if (households.length === 0) return [await seedGarden(db)];

	const reports: SeedReport[] = [];
	for (const h of households) {
		reports.push(await seedHousehold(db, asHouseholdId(h.id), h.profile));
	}
	return reports;
}
