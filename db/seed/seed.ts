/**
 * Seeding the garden. Safe to re-run at any time.
 *
 * The rule that makes it safe: seeding only ever touches what it still owns.
 * A rule is the seed's while `source = 'seed'` and nobody has edited it. The
 * moment you change a plant's pruning in the app, pruning becomes yours -
 * the seed stops deleting it *and* stops writing its own version back, so
 * re-running never resurrects what you replaced or leaves you with two of
 * everything.
 */
import { and, eq, isNotNull, isNull, ne, or } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { careRule, environment, meta, planting, plantType } from '@/lib/db/schema';
import { maskFromMonths } from '@/lib/schedule/months';
import {
	environments as orchardEnvironments,
	plantTypes as orchardPlantTypes,
	SEED_SOURCE,
	SEED_VERSION,
} from './orchard';
import {
	type SeedPlantType,
	seedEnvironmentSchema,
	seedPlantTypeSchema,
} from './schema';
import { vegEnvironments, vegPlantTypes } from './veg';

export type SeedReport = {
	version: string;
	environments: number;
	plantTypes: number;
	plantings: number;
	rules: number;
	leftAlone: string[];
};

const environments = [...orchardEnvironments, ...vegEnvironments];
const plantTypes = [...orchardPlantTypes, ...vegPlantTypes];

function seedEnvironments(db: Db) {
	let created = 0;
	for (const raw of environments) {
		const env = seedEnvironmentSchema.parse(raw);
		const existing = db
			.select({ id: environment.id })
			.from(environment)
			.where(eq(environment.slug, env.slug))
			.get();

		if (existing) {
			db.update(environment)
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
			db.insert(environment).values(env).run();
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
function userOwnedActions(db: Db, plantTypeId: number): Set<string> {
	const rows = db
		.select({ action: careRule.action })
		.from(careRule)
		.where(
			and(
				eq(careRule.plantTypeId, plantTypeId),
				or(ne(careRule.source, 'seed'), isNotNull(careRule.userModifiedAt)),
			),
		)
		.all();
	return new Set(rows.map((r) => r.action));
}

function seedRulesFor(db: Db, plantTypeId: number, pt: SeedPlantType) {
	const owned = userOwnedActions(db, plantTypeId);

	// Clear out only the rules this seed still owns, then lay them down fresh.
	db.delete(careRule)
		.where(
			and(
				eq(careRule.plantTypeId, plantTypeId),
				eq(careRule.source, 'seed'),
				isNull(careRule.userModifiedAt),
			),
		)
		.run();

	let written = 0;
	for (const rule of pt.rules) {
		if (owned.has(rule.action)) continue;

		const sourceRef = `${SEED_SOURCE} / ${pt.commonName} / ${rule.action}`;

		if (rule.months) {
			db.insert(careRule)
				.values({
					plantTypeId,
					action: rule.action,
					monthMask: maskFromMonths(rule.months),
					cadence: rule.cadence,
					note: rule.note,
					source: 'seed',
					sourceRef,
				})
				.run();
			written++;
			continue;
		}

		// Alternatives: one rule per option, tied together by a shared group.
		const altGroup = `${pt.slug}:${rule.action}`;
		for (const option of rule.anyOf ?? []) {
			db.insert(careRule)
				.values({
					plantTypeId,
					action: rule.action,
					monthMask: maskFromMonths(option),
					cadence: rule.cadence,
					altGroup,
					note: rule.note,
					source: 'seed',
					sourceRef,
				})
				.run();
			written++;
		}
	}
	return { written, owned: [...owned] };
}

function seedPlantingsFor(
	db: Db,
	plantTypeId: number,
	pt: SeedPlantType,
	environmentId: number,
) {
	let created = 0;
	for (const label of pt.plantings) {
		const existing = db
			.select({ id: planting.id })
			.from(planting)
			.where(and(eq(planting.plantTypeId, plantTypeId), eq(planting.label, label)))
			.get();
		if (existing) continue;

		db.insert(planting)
			.values({ plantTypeId, environmentId, label, status: 'active' })
			.run();
		created++;
	}
	return created;
}

export function seedGarden(db: Db): SeedReport {
	const newEnvironments = seedEnvironments(db);

	const orchard = db
		.select({ id: environment.id })
		.from(environment)
		.where(eq(environment.slug, 'orchard'))
		.get();
	if (!orchard) {
		throw new Error('The orchard environment is missing after seeding.');
	}

	const report: SeedReport = {
		version: SEED_VERSION,
		environments: newEnvironments,
		plantTypes: 0,
		plantings: 0,
		rules: 0,
		leftAlone: [],
	};

	for (const raw of plantTypes) {
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

		const existing = db
			.select({ id: plantType.id, userModifiedAt: plantType.userModifiedAt })
			.from(plantType)
			.where(eq(plantType.slug, pt.slug))
			.get();

		let plantTypeId: number;
		if (!existing) {
			plantTypeId = db
				.insert(plantType)
				.values({ slug: pt.slug, ...fields })
				.returning({ id: plantType.id })
				.get().id;
			report.plantTypes++;
		} else {
			plantTypeId = existing.id;
			if (existing.userModifiedAt) {
				report.leftAlone.push(pt.slug);
			} else {
				db.update(plantType).set(fields).where(eq(plantType.id, plantTypeId)).run();
			}
		}

		const rules = seedRulesFor(db, plantTypeId, pt);
		report.rules += rules.written;
		for (const action of rules.owned) {
			report.leftAlone.push(`${pt.slug}:${action}`);
		}

		report.plantings += seedPlantingsFor(db, plantTypeId, pt, orchard.id);
	}

	db.insert(meta)
		.values({ key: 'seed_version', value: SEED_VERSION })
		.onConflictDoUpdate({ target: meta.key, set: { value: SEED_VERSION } })
		.run();

	return report;
}
