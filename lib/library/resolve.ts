/**
 * A library plant, whole.
 *
 * A variety keeps only what differs from its parent, so before anything can
 * use one - a household's copy, an article, the line that says when to sow -
 * it has to be filled in. This is the one place that does it, so the rules of
 * inheritance cannot drift between the places that need them:
 *
 *  - A field the variety leaves empty is its parent's.
 *  - A variety's rules for an action replace its parent's rules for that
 *    action. An action it gives no rule for is its parent's. This is the same
 *    shadowing a planting's own rule does over its plant's.
 *  - Needing review is catching: a kind of something unchecked is unchecked.
 *
 * Pure: it takes rows, not a database, so the seed can resolve plants it has
 * only just written and a test can resolve ones that were never written.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { Db, Tx } from '@/lib/db/client';
import {
	libraryPlant,
	libraryRegionNote,
	libraryRule,
	type RegionId,
} from '@/lib/db/schema';

export type LibraryPlantRow = typeof libraryPlant.$inferSelect;
export type LibraryRuleRow = typeof libraryRule.$inferSelect;

export type ResolvedRule = Pick<
	LibraryRuleRow,
	| 'action'
	| 'monthMask'
	| 'cadence'
	| 'altGroup'
	| 'environmentKind'
	| 'label'
	| 'note'
> & {
	/** The plant this rule is written on: the variety, or the parent it came from. */
	from: string;
};

export type ResolvedPlant = {
	id: number;
	slug: string;
	/** The plant this is a kind of, if it is one. */
	parent: { id: number; slug: string; commonName: string } | null;
	commonName: string;
	scientificName: string | null;
	aliases: string[];
	category: NonNullable<LibraryPlantRow['category']>;
	lifecycle: NonNullable<LibraryPlantRow['lifecycle']>;
	family: string | null;
	daysToMaturityMin: number | null;
	daysToMaturityMax: number | null;
	spacingCm: number | null;
	rowSpacingCm: number | null;
	summary: string | null;
	growingMd: string | null;
	careMd: string | null;
	harvestMd: string | null;
	problemsMd: string | null;
	/** The pages the article was written from, as stored: JSON, or null. */
	citations: string | null;
	/** "What gardens found here", as a site admin wrote it. */
	findingsMd: string | null;
	regionNote: string | null;
	needsReview: boolean;
	/**
	 * Its own revision plus its parent's. Both only ever go up, so the sum does
	 * too, and a copy can tell it is behind when either one changes.
	 */
	revision: number;
	region: RegionId;
	rules: ResolvedRule[];
};

function aliasesOf(raw: string | null): string[] {
	if (!raw) return [];
	const parsed: unknown = JSON.parse(raw);
	return Array.isArray(parsed)
		? parsed.filter((a): a is string => typeof a === 'string')
		: [];
}

function rulesOf(plant: LibraryPlantRow, rules: LibraryRuleRow[]) {
	return rules
		.filter((r) => r.libraryPlantId === plant.id)
		.sort((a, b) => a.id - b.id)
		.map(
			(r): ResolvedRule => ({
				action: r.action,
				monthMask: r.monthMask,
				cadence: r.cadence,
				altGroup: r.altGroup,
				environmentKind: r.environmentKind,
				label: r.label,
				note: r.note,
				from: plant.commonName,
			}),
		);
}

/**
 * Fills a plant in from its parent. `rules` and `notes` may hold rows for
 * other plants and regions too; only this plant's, its parent's and this
 * region's are read.
 */
export function resolvePlant(
	plant: LibraryPlantRow,
	parent: LibraryPlantRow | null,
	region: RegionId,
	rules: LibraryRuleRow[],
	notes: { libraryPlantId: number; region: RegionId; noteMd: string }[],
): ResolvedPlant {
	if (plant.parentId !== null && parent?.id !== plant.parentId) {
		throw new Error(`${plant.slug} is a variety, and needs its parent to resolve`);
	}
	const here = rules.filter((r) => r.region === region);
	const own = rulesOf(plant, here);
	const overridden = new Set(own.map((r) => r.action));
	const inherited = parent
		? rulesOf(parent, here).filter((r) => !overridden.has(r.action))
		: [];

	const noteFor = (id: number) =>
		notes.find((n) => n.libraryPlantId === id && n.region === region)?.noteMd ??
		null;

	const category = plant.category ?? parent?.category;
	const lifecycle = plant.lifecycle ?? parent?.lifecycle;
	if (!category || !lifecycle) {
		// The check constraint makes this unreachable for a plant, and the
		// one-level trigger for a variety; this keeps the types honest.
		throw new Error(`${plant.slug} does not say what kind of plant it is`);
	}

	return {
		id: plant.id,
		slug: plant.slug,
		parent: parent
			? { id: parent.id, slug: parent.slug, commonName: parent.commonName }
			: null,
		commonName: plant.commonName,
		scientificName: plant.scientificName ?? parent?.scientificName ?? null,
		aliases: aliasesOf(plant.aliases),
		category,
		lifecycle,
		family: plant.family ?? parent?.family ?? null,
		daysToMaturityMin: plant.daysToMaturityMin ?? parent?.daysToMaturityMin ?? null,
		daysToMaturityMax: plant.daysToMaturityMax ?? parent?.daysToMaturityMax ?? null,
		spacingCm: plant.spacingCm ?? parent?.spacingCm ?? null,
		rowSpacingCm: plant.rowSpacingCm ?? parent?.rowSpacingCm ?? null,
		summary: plant.summary ?? parent?.summary ?? null,
		growingMd: plant.growingMd ?? parent?.growingMd ?? null,
		careMd: plant.careMd ?? parent?.careMd ?? null,
		harvestMd: plant.harvestMd ?? parent?.harvestMd ?? null,
		problemsMd: plant.problemsMd ?? parent?.problemsMd ?? null,
		citations: plant.citations ?? parent?.citations ?? null,
		findingsMd: plant.findingsMd ?? parent?.findingsMd ?? null,
		regionNote: noteFor(plant.id) ?? (parent ? noteFor(parent.id) : null),
		needsReview: plant.needsReview || (parent?.needsReview ?? false),
		revision: plant.revision + (parent?.revision ?? 0),
		region,
		rules: [...inherited, ...own],
	};
}

/**
 * Loads and resolves library plants by slug, with their parents. Slugs the
 * library does not have are left out rather than thrown on.
 */
export async function loadResolved(
	db: Db | Tx,
	slugs: readonly string[],
	region: RegionId,
): Promise<ResolvedPlant[]> {
	if (slugs.length === 0) return [];
	const plants = await db
		.select()
		.from(libraryPlant)
		.where(inArray(libraryPlant.slug, [...slugs]))
		.all();
	const parentIds = plants
		.map((p) => p.parentId)
		.filter((id): id is number => id !== null);
	const parents =
		parentIds.length > 0
			? await db
					.select()
					.from(libraryPlant)
					.where(inArray(libraryPlant.id, parentIds))
					.all()
			: [];
	const ids = [...plants, ...parents].map((p) => p.id);
	const rules = await db
		.select()
		.from(libraryRule)
		.where(
			and(inArray(libraryRule.libraryPlantId, ids), eq(libraryRule.region, region)),
		)
		.all();
	const notes = await db
		.select()
		.from(libraryRegionNote)
		.where(
			and(
				inArray(libraryRegionNote.libraryPlantId, ids),
				eq(libraryRegionNote.region, region),
			),
		)
		.all();

	const byId = new Map(parents.map((p) => [p.id, p]));
	const bySlug = new Map(plants.map((p) => [p.slug, p]));
	return slugs.flatMap((slug) => {
		const plant = bySlug.get(slug);
		if (!plant) return [];
		const parent =
			plant.parentId !== null ? (byId.get(plant.parentId) ?? null) : null;
		return [resolvePlant(plant, parent, region, rules, notes)];
	});
}

/**
 * Every library plant, resolved, in the order the catalogue reads. The
 * library is a few dozen rows, so the index and the search read all of it
 * and filter in memory rather than asking the database twice.
 */
export async function loadAllResolved(
	db: Db | Tx,
	region: RegionId,
): Promise<ResolvedPlant[]> {
	const plants = await db.select().from(libraryPlant).all();
	const rules = await db
		.select()
		.from(libraryRule)
		.where(eq(libraryRule.region, region))
		.all();
	const notes = await db
		.select()
		.from(libraryRegionNote)
		.where(eq(libraryRegionNote.region, region))
		.all();
	const byId = new Map(plants.map((p) => [p.id, p]));
	return plants
		.map((plant) =>
			resolvePlant(
				plant,
				plant.parentId !== null ? (byId.get(plant.parentId) ?? null) : null,
				region,
				rules,
				notes,
			),
		)
		.sort((a, b) => a.commonName.localeCompare(b.commonName));
}
