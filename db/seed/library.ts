/**
 * Writing the library from the catalogue in db/seed. Safe to re-run at any
 * time, and run on every deploy.
 *
 * The same promise as seeding a garden, one level up: the seed only touches
 * what it still owns. A library plant, rule or note is the seed's while its
 * source is `seed` and no site admin has curated it. Once one has, the seed
 * leaves that plant (or that plant's action, for rules) alone for good.
 *
 * Anything that changes bumps the plant's revision, which is how a
 * household's copy knows it is behind.
 */
import { and, eq, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm';
import type { Db, Tx } from '@/lib/db/client';
import {
	libraryPlant,
	libraryRegionNote,
	libraryRule,
	meta,
	type RegionId,
} from '@/lib/db/schema';
import { maskFromMonths } from '@/lib/schedule/months';
import { type SeedLibraryPlant, seedLibraryPlantSchema } from './schema';
import { vegLibrary } from './veg';

/** Bump when the catalogue changes, so a new garden knows to write it first. */
export const LIBRARY_SEED_VERSION = '2026-10-27.1';
const VERSION_KEY = 'library_seed_version';

export type LibraryReport = {
	version: string;
	plants: number;
	revised: number;
	leftAlone: string[];
};

type LibraryRuleInsert = typeof libraryRule.$inferInsert;

function ruleRows(
	libraryPlantId: number,
	p: SeedLibraryPlant,
): LibraryRuleInsert[] {
	return Object.entries(p.rules).flatMap(([region, rules]) =>
		rules.flatMap((rule): LibraryRuleInsert[] => {
			const common = {
				libraryPlantId,
				region: region as RegionId,
				action: rule.action,
				cadence: rule.cadence,
				note: rule.note ?? null,
				source: 'seed' as const,
				sourceRef: 'Starter set',
			};
			if (rule.months) {
				return [
					{ ...common, monthMask: maskFromMonths(rule.months), altGroup: null },
				];
			}
			const altGroup = `${p.slug}:${rule.action}`;
			return (rule.anyOf ?? []).map((option) => ({
				...common,
				monthMask: maskFromMonths(option),
				altGroup,
			}));
		}),
	);
}

function ruleKey(r: {
	region: string;
	action: string;
	monthMask: number;
	cadence?: string | null;
	altGroup?: string | null;
	note?: string | null;
}) {
	return JSON.stringify([
		r.region,
		r.action,
		r.monthMask,
		r.cadence ?? null,
		r.altGroup ?? null,
		r.note ?? null,
	]);
}

/** Brings one plant's seed-owned rules in line; true if anything changed. */
async function seedRules(
	db: Db | Tx,
	libraryPlantId: number,
	p: SeedLibraryPlant,
): Promise<{ changed: boolean; curated: string[] }> {
	const curatedRows = await db
		.select({ region: libraryRule.region, action: libraryRule.action })
		.from(libraryRule)
		.where(
			and(
				eq(libraryRule.libraryPlantId, libraryPlantId),
				or(ne(libraryRule.source, 'seed'), isNotNull(libraryRule.curatedAt)),
			),
		)
		.all();
	const curated = new Set(curatedRows.map((r) => `${r.region}:${r.action}`));
	const seedOwned = and(
		eq(libraryRule.libraryPlantId, libraryPlantId),
		eq(libraryRule.source, 'seed'),
		isNull(libraryRule.curatedAt),
	);

	const existing = await db.select().from(libraryRule).where(seedOwned).all();
	const unclaimed = new Map<string, number[]>();
	for (const rule of existing) {
		const key = ruleKey(rule);
		unclaimed.set(key, [...(unclaimed.get(key) ?? []), rule.id]);
	}
	const toInsert = ruleRows(libraryPlantId, p)
		.filter((r) => !curated.has(`${r.region}:${r.action}`))
		.filter((rule) => {
			const ids = unclaimed.get(ruleKey(rule));
			if (ids && ids.length > 0) {
				ids.shift();
				return false;
			}
			return true;
		});
	const stale = [...unclaimed.values()].flat();

	if (stale.length > 0) {
		await db
			.delete(libraryRule)
			.where(and(seedOwned, inArray(libraryRule.id, stale)))
			.run();
	}
	if (toInsert.length > 0) await db.insert(libraryRule).values(toInsert).run();
	return {
		changed: stale.length > 0 || toInsert.length > 0,
		curated: [...curated],
	};
}

/** Brings one plant's seed-owned region notes in line; true if anything changed. */
async function seedNotes(
	db: Db | Tx,
	libraryPlantId: number,
	p: SeedLibraryPlant,
): Promise<boolean> {
	let changed = false;
	for (const [region, noteMd] of Object.entries(p.regionNotes)) {
		const existing = await db
			.select()
			.from(libraryRegionNote)
			.where(
				and(
					eq(libraryRegionNote.libraryPlantId, libraryPlantId),
					eq(libraryRegionNote.region, region as RegionId),
				),
			)
			.get();
		if (!existing) {
			await db
				.insert(libraryRegionNote)
				.values({ libraryPlantId, region: region as RegionId, noteMd })
				.run();
			changed = true;
		} else if (
			existing.source === 'seed' &&
			!existing.curatedAt &&
			existing.noteMd !== noteMd
		) {
			await db
				.update(libraryRegionNote)
				.set({ noteMd })
				.where(
					and(
						eq(libraryRegionNote.libraryPlantId, libraryPlantId),
						eq(libraryRegionNote.region, region as RegionId),
					),
				)
				.run();
			changed = true;
		}
	}
	return changed;
}

/** The columns the seed writes, in a form two of them can be compared in. */
function plantFields(p: SeedLibraryPlant, parentId: number | null) {
	return {
		parentId,
		commonName: p.commonName,
		scientificName: p.scientificName ?? null,
		aliases: p.aliases.length > 0 ? JSON.stringify(p.aliases) : null,
		category: p.category ?? null,
		lifecycle: p.lifecycle ?? null,
		family: p.family ?? null,
		daysToMaturityMin: p.daysToMaturityMin ?? null,
		daysToMaturityMax: p.daysToMaturityMax ?? null,
		spacingCm: p.spacingCm ?? null,
		summary: p.summary ?? null,
		needsReview: p.needsReview,
		source: 'seed' as const,
		sourceRef: 'Starter set',
	};
}

/** Writes the catalogue into the library, leaving curated plants alone. */
export async function seedLibrary(db: Db | Tx): Promise<LibraryReport> {
	const parsed = vegLibrary.map((raw) => seedLibraryPlantSchema.parse(raw));
	// Parents before their varieties, so every parent has an id to point at.
	const ordered = [
		...parsed.filter((p) => !p.parent),
		...parsed.filter((p) => p.parent),
	];

	const report: LibraryReport = {
		version: LIBRARY_SEED_VERSION,
		plants: 0,
		revised: 0,
		leftAlone: [],
	};
	const idOf = new Map<string, number>();

	for (const p of ordered) {
		const parentId = p.parent ? idOf.get(p.parent) : null;
		if (parentId === undefined) {
			throw new Error(
				`${p.slug} is a kind of ${p.parent}, which the catalogue lacks`,
			);
		}
		const fields = plantFields(p, parentId);
		const existing = await db
			.select()
			.from(libraryPlant)
			.where(eq(libraryPlant.slug, p.slug))
			.get();

		let id: number;
		let changed = false;
		if (!existing) {
			id = (
				await db
					.insert(libraryPlant)
					.values({ slug: p.slug, ...fields })
					.returning({ id: libraryPlant.id })
					.get()
			).id;
			report.plants++;
		} else {
			id = existing.id;
			if (existing.curatedAt || existing.source !== 'seed') {
				report.leftAlone.push(p.slug);
				idOf.set(p.slug, id);
				continue;
			}
			const before = JSON.stringify(
				Object.keys(fields).map((k) => existing[k as keyof typeof existing]),
			);
			const after = JSON.stringify(Object.values(fields));
			if (before !== after) {
				await db
					.update(libraryPlant)
					.set(fields)
					.where(eq(libraryPlant.id, id))
					.run();
				changed = true;
			}
		}
		idOf.set(p.slug, id);

		const rules = await seedRules(db, id, p);
		for (const action of rules.curated)
			report.leftAlone.push(`${p.slug}:${action}`);
		const notes = await seedNotes(db, id, p);

		if (existing && (changed || rules.changed || notes)) {
			await db
				.update(libraryPlant)
				.set({ revision: existing.revision + 1 })
				.where(eq(libraryPlant.id, id))
				.run();
			report.revised++;
		}
	}

	await db
		.insert(meta)
		.values({ key: VERSION_KEY, value: LIBRARY_SEED_VERSION })
		.onConflictDoUpdate({ target: meta.key, set: { value: LIBRARY_SEED_VERSION } })
		.run();
	return report;
}

/**
 * Writes the library only if this catalogue has not been written yet. For a
 * new garden made before any deploy has seeded - a test database, or the
 * first sign-up after a migration - so it never starts from an empty library.
 */
export async function ensureLibrary(db: Db | Tx): Promise<void> {
	const row = await db
		.select({ value: meta.value })
		.from(meta)
		.where(eq(meta.key, VERSION_KEY))
		.get();
	if (row?.value !== LIBRARY_SEED_VERSION) await seedLibrary(db);
}
