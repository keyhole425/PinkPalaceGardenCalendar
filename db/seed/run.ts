/**
 * Seeds the orchard. Safe to re-run at any time.
 *
 * The rule that makes it safe: seeding only ever touches rows it still owns -
 * `source = 'seed'` with no `user_modified_at`. The moment you edit a rule in
 * the app, that rule stops being the seed's business and later runs leave it
 * exactly as you left it.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { careRule, environment, meta, planting, plantType } from '@/lib/db/schema';
import { maskFromMonths } from '@/lib/schedule/months';
import { environments, plantTypes, SEED_SOURCE, SEED_VERSION } from './orchard';
import { seedEnvironmentSchema, seedPlantTypeSchema } from './schema';

function seedEnvironments() {
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

function seedPlantTypes(defaultEnvironmentId: number) {
	const counts = { types: 0, rules: 0, plantings: 0, skipped: 0 };

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
			source: 'seed' as const,
			sourceRef: SEED_SOURCE,
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
			counts.types++;
		} else {
			plantTypeId = existing.id;
			if (existing.userModifiedAt) {
				counts.skipped++;
			} else {
				db.update(plantType).set(fields).where(eq(plantType.id, plantTypeId)).run();
			}
		}

		counts.rules += seedRulesFor(plantTypeId, pt);
		counts.plantings += seedPlantingsFor(plantTypeId, pt, defaultEnvironmentId);
	}

	return counts;
}

function seedRulesFor(
	plantTypeId: number,
	pt: ReturnType<typeof seedPlantTypeSchema.parse>,
) {
	// Clear out only the rules this seed still owns, then lay them down fresh.
	// Anything a human has touched survives untouched.
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
	return written;
}

function seedPlantingsFor(
	plantTypeId: number,
	pt: ReturnType<typeof seedPlantTypeSchema.parse>,
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

function main() {
	const newEnvironments = seedEnvironments();

	const orchard = db
		.select({ id: environment.id })
		.from(environment)
		.where(eq(environment.slug, 'orchard'))
		.get();
	if (!orchard) {
		throw new Error('The orchard environment is missing after seeding.');
	}

	const counts = seedPlantTypes(orchard.id);

	db.insert(meta)
		.values({ key: 'seed_version', value: SEED_VERSION })
		.onConflictDoUpdate({ target: meta.key, set: { value: SEED_VERSION } })
		.run();

	console.log(
		[
			`figgy seed ${SEED_VERSION}`,
			`  environments created: ${newEnvironments}`,
			`  plant types created:  ${counts.types}`,
			`  plantings created:    ${counts.plantings}`,
			`  rules written:        ${counts.rules}`,
			`  left alone (edited):  ${counts.skipped}`,
		].join('\n'),
	);
}

main();
