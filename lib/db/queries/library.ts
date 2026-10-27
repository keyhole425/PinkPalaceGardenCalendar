/**
 * The Plants tab: the library, as one household sees it.
 *
 * Everything here reads both sides - the household's own plants and the
 * shared library - and puts them together the way the page reads: what you
 * have first, the rest of the library after, and one article per plant
 * whichever side it lives on.
 */
import { and, asc, count, eq, isNull, ne } from 'drizzle-orm';
import { REGIONS } from '@/lib/ai/locale';
import type { Citation } from '@/lib/ai/schema';
import { type IsoDate, today as todayInGarden } from '@/lib/dates';
import {
	actionOrder,
	hereLine,
	inSeason,
	type PlaceLike,
	type RuleLike,
	shiftLines,
} from '@/lib/library/describe';
import { loadAllResolved, type ResolvedPlant } from '@/lib/library/resolve';
import type { Month } from '@/lib/schedule/months';
import { db } from '../client';
import { careRule, environment, planting, plantType } from '../schema';
import { type HouseholdId, owns } from '../tenancy';
import { listPlaces } from './beds';
import { householdRegion } from './household';
import { getEditableRules } from './plant';

export type PlantCategory = 'fruit_tree' | 'vegetable' | 'herb' | 'other';

/** One row of the index, from either side. */
export type IndexRow = {
	slug: string;
	commonName: string;
	scientificName: string | null;
	category: PlantCategory;
	/** The plant this is a kind of: "chilli". */
	kindOf: string | null;
	/** How many kinds it has, for a plant that has some. */
	kinds: number;
	/** "Sow Aug–Oct · ready in 70–90 days". */
	line: string;
	/** Whether this month is a sowing month in one of this garden's places. */
	sowNow: boolean;
	/** How many are growing, for one of the household's plants; null otherwise. */
	growing: number | null;
	needsReview: boolean;
	/** Everything a search matches against, lower-cased. */
	terms: string[];
};

export type PlantsIndex = {
	city: string;
	/** The household's own plants, copies or not. */
	yours: IndexRow[];
	/**
	 * The library plants the household has no copy of. Varieties are here
	 * too, for search; the index lists only plants and says how many kinds.
	 */
	more: (IndexRow & { isVariety: boolean })[];
};

async function placesFor(hid: HouseholdId): Promise<PlaceLike[]> {
	return await db
		.select({
			name: environment.name,
			kind: environment.kind,
			windowShiftMonths: environment.windowShiftMonths,
		})
		.from(environment)
		.where(and(owns(environment, hid), isNull(environment.archivedOn)))
		.orderBy(asc(environment.sortOrder), asc(environment.id))
		.all();
}

function termsOf(...values: (string | null | undefined | string[])[]): string[] {
	return values
		.flat()
		.filter((v): v is string => Boolean(v))
		.map((v) => v.toLowerCase());
}

function kindsByParent(library: ResolvedPlant[]): Map<number, ResolvedPlant[]> {
	const kinds = new Map<number, ResolvedPlant[]>();
	for (const plant of library) {
		if (!plant.parent) continue;
		kinds.set(plant.parent.id, [...(kinds.get(plant.parent.id) ?? []), plant]);
	}
	return kinds;
}

function libraryRow(
	plant: ResolvedPlant,
	kinds: number,
	places: PlaceLike[],
	month: Month,
): IndexRow {
	const rules: RuleLike[] = plant.rules;
	return {
		slug: plant.slug,
		commonName: plant.commonName,
		scientificName: plant.scientificName,
		category: plant.category,
		kindOf: plant.parent?.commonName.toLowerCase() ?? null,
		kinds,
		line: hereLine(rules, plant.daysToMaturityMin, plant.daysToMaturityMax),
		sowNow: inSeason(rules, 'sow', places, month),
		growing: null,
		needsReview: plant.needsReview,
		terms: termsOf(
			plant.commonName,
			plant.scientificName,
			plant.family,
			plant.aliases,
			plant.parent?.commonName,
		),
	};
}

export async function plantsIndex(
	hid: HouseholdId,
	when: IsoDate = todayInGarden(),
): Promise<PlantsIndex> {
	const month = Number(when.slice(5, 7)) as Month;
	const region = await householdRegion(hid);
	const [library, places] = await Promise.all([
		loadAllResolved(db, region),
		placesFor(hid),
	]);
	const byId = new Map(library.map((p) => [p.id, p]));
	const kinds = kindsByParent(library);

	const own = await db
		.select({
			id: plantType.id,
			slug: plantType.slug,
			commonName: plantType.commonName,
			scientificName: plantType.scientificName,
			category: plantType.category,
			family: plantType.family,
			needsReview: plantType.needsReview,
			libraryPlantId: plantType.libraryPlantId,
			daysToMaturityMin: plantType.daysToMaturityMin,
			daysToMaturityMax: plantType.daysToMaturityMax,
			growing: count(planting.id),
		})
		.from(plantType)
		.leftJoin(
			planting,
			and(eq(planting.plantTypeId, plantType.id), ne(planting.status, 'removed')),
		)
		.where(owns(plantType, hid))
		.groupBy(plantType.id)
		.orderBy(asc(plantType.commonName))
		.all();

	const rules = await db
		.select({
			plantTypeId: careRule.plantTypeId,
			action: careRule.action,
			monthMask: careRule.monthMask,
			altGroup: careRule.altGroup,
			environmentKind: careRule.environmentKind,
		})
		.from(careRule)
		.where(
			and(
				owns(careRule, hid),
				isNull(careRule.plantingId),
				eq(careRule.active, true),
			),
		)
		.all();

	const yours: IndexRow[] = own.map((p) => {
		const these = rules.filter((r) => r.plantTypeId === p.id);
		const lib = p.libraryPlantId !== null ? byId.get(p.libraryPlantId) : undefined;
		return {
			slug: p.slug,
			commonName: p.commonName,
			scientificName: p.scientificName,
			category: p.category,
			kindOf: lib?.parent?.commonName.toLowerCase() ?? null,
			kinds: lib ? (kinds.get(lib.id)?.length ?? 0) : 0,
			line: hereLine(these, p.daysToMaturityMin, p.daysToMaturityMax),
			sowNow: inSeason(these, 'sow', places, month),
			growing: p.growing,
			needsReview: p.needsReview,
			terms: termsOf(
				p.commonName,
				p.scientificName,
				p.family,
				lib?.aliases,
				lib?.parent?.commonName,
			),
		};
	});

	const linked = new Set(own.map((p) => p.libraryPlantId));
	const ownSlugs = new Set(own.map((p) => p.slug));
	const more = library
		// A plant of the household's own that shares a slug hides the library's:
		// both would open the same address, and that address is theirs.
		.filter((p) => !linked.has(p.id) && !ownSlugs.has(p.slug))
		.map((p) => ({
			...libraryRow(p, kinds.get(p.id)?.length ?? 0, places, month),
			isVariety: p.parent !== null,
		}));

	return { city: REGIONS[region].city, yours, more };
}

/**
 * Plants matching what someone typed, theirs first. Every word has to match
 * something: "bird chilli" finds bird's eye, "chilli" finds every kind of one.
 */
export function searchIndex(index: PlantsIndex, query: string): IndexRow[] {
	const words = query
		.toLowerCase()
		.replace(/[’']/g, '')
		.split(/\s+/)
		.filter(Boolean);
	if (words.length === 0) return [];
	const matches = (row: IndexRow) =>
		words.every((w) => row.terms.some((t) => t.replace(/[’']/g, '').includes(w)));
	// A plant before its kinds, so "chilli" leads with the chilli.
	const plantsFirst = (a: IndexRow, b: IndexRow) =>
		Number(a.kindOf !== null) - Number(b.kindOf !== null);
	return [
		...index.yours.filter(matches).sort(plantsFirst),
		...index.more.filter(matches).sort(plantsFirst),
	];
}

export type ArticleRule = {
	ruleIds: string;
	action: string;
	monthMask: number;
	/** The plant this window is written on, when it isn't this one. */
	from: string | null;
};

/** A place the "Sow some" form can put this in, and the spot it would take. */
export type SowPlace = {
	id: number;
	slug: string;
	name: string;
	/** The first free spot, for a place laid out in spots. */
	spot: { x: number; y: number } | null;
	full: boolean;
};

export type Article = {
	slug: string;
	commonName: string;
	scientificName: string | null;
	lifecycle: string;
	family: string | null;
	city: string;
	parent: { slug: string; commonName: string } | null;
	summary: string | null;
	regionNote: string | null;
	sections: { title: string; body: string }[];
	citations: Citation[];
	daysToMaturityMin: number | null;
	daysToMaturityMax: number | null;
	spacingCm: number | null;
	needsReview: boolean;
	when: ArticleRule[];
	shiftLines: string[];
	/** Its kinds, for a plant; the other kinds of its parent, for a variety. */
	kinds: { title: string; rows: IndexRow[] } | null;
	/** True when the library has it; false for a plant of the household's own. */
	inLibrary: boolean;
	/** The household's copy, if it has one, and the address it lives at. */
	plantTypeId: number | null;
	ownSlug: string | null;
	/** True when the household's months are not the library's any more. */
	differs: boolean;
	/** "What gardens found here", as a site admin wrote it. */
	findings: string | null;
	/** What following the library last changed in this garden, and when. */
	libraryChange: { what: string; on: string } | null;
	places: SowPlace[];
};

function citationsOf(raw: string | null): Citation[] {
	if (!raw) return [];
	const parsed: unknown = JSON.parse(raw);
	return Array.isArray(parsed) ? (parsed as Citation[]) : [];
}

function groupRules(rules: (RuleLike & { from: string | null })[]): ArticleRule[] {
	const groups = new Map<string, (RuleLike & { from: string | null })[]>();
	rules.forEach((rule, i) => {
		if (rule.monthMask === 0) return;
		const key = rule.altGroup ?? `rule:${i}`;
		groups.set(key, [...(groups.get(key) ?? []), rule]);
	});
	return [...groups.entries()].map(([key, members]) => ({
		ruleIds: key,
		action: members[0].action,
		monthMask: members.reduce((mask, m) => mask | m.monthMask, 0),
		from: members[0].from,
	}));
}

/**
 * Where this could go. The orchard is for trees: offering it first for a
 * habanero made it the default, one tap from a chilli among the citrus.
 */
async function sowPlaces(
	hid: HouseholdId,
	category: PlantCategory,
): Promise<SowPlace[]> {
	const places = (await listPlaces(hid)).filter(
		(p) =>
			(p.kind === 'orchard') === (category === 'fruit_tree') || p.kind === 'pot',
	);
	return places.map((place) => {
		if (place.kind === 'orchard') {
			return {
				id: place.id,
				slug: place.slug,
				name: place.name,
				spot: null,
				full: false,
			};
		}
		for (let y = 0; y < place.gridRows; y++) {
			for (let x = 0; x < place.gridCols; x++) {
				const taken = place.occupants.some((o) => o.posX === x && o.posY === y);
				if (!taken) {
					return {
						id: place.id,
						slug: place.slug,
						name: place.name,
						spot: { x, y },
						full: false,
					};
				}
			}
		}
		return {
			id: place.id,
			slug: place.slug,
			name: place.name,
			spot: null,
			full: true,
		};
	});
}

/**
 * One plant's article. The household's own plant wins its address; failing
 * that, the library's plant of that slug. Null when neither has it, which is
 * how one garden's own plants stay out of another's.
 */
export async function getArticle(
	hid: HouseholdId,
	slug: string,
	when: IsoDate = todayInGarden(),
): Promise<Article | null> {
	const month = Number(when.slice(5, 7)) as Month;
	const region = await householdRegion(hid);
	const bySlug = await db
		.select()
		.from(plantType)
		.where(and(owns(plantType, hid), eq(plantType.slug, slug)))
		.get();

	const library = await loadAllResolved(db, region);
	// A copy can sit at an address of its own - a plant the garden added
	// before the library had it - and is still this library plant's copy.
	const atSlug = library.find((p) => p.slug === slug);
	const own =
		bySlug ??
		(atSlug
			? await db
					.select()
					.from(plantType)
					.where(and(owns(plantType, hid), eq(plantType.libraryPlantId, atSlug.id)))
					.get()
			: undefined);
	const lib = own
		? own.libraryPlantId !== null
			? library.find((p) => p.id === own.libraryPlantId)
			: undefined
		: library.find((p) => p.slug === slug);
	if (!own && !lib) return null;

	const places = await placesFor(hid);
	const kindsOf = kindsByParent(library);
	const city = REGIONS[region].city;

	let when_: ArticleRule[];
	let differs = false;
	if (lib) {
		when_ = groupRules(
			lib.rules.map((r) => ({
				...r,
				from: r.from === lib.commonName ? null : r.from.toLowerCase(),
			})),
		);
		if (own) {
			const mine = await getEditableRules(hid, own.id);
			differs = mine.some((r) => r.source !== 'library' || r.edited);
		}
	} else {
		when_ = (await getEditableRules(hid, own!.id)).map((r) => ({
			ruleIds: r.ruleIds.join(','),
			action: r.action,
			monthMask: r.monthMask,
			from: null,
		}));
	}
	// In the order the year is done in, not the order the rows were written:
	// a variety's own sowing would otherwise follow the transplant it inherits.
	when_.sort((a, b) => actionOrder(a.action) - actionOrder(b.action));
	const asRules: RuleLike[] = when_.map((r) => ({
		action: r.action,
		monthMask: r.monthMask,
		altGroup: null,
		environmentKind: null,
	}));

	let kinds: Article['kinds'] = null;
	if (lib) {
		const parentId = lib.parent?.id ?? lib.id;
		const family = (kindsOf.get(parentId) ?? []).filter((k) => k.id !== lib.id);
		if (family.length > 0) {
			kinds = {
				title: lib.parent
					? `Other kinds of ${lib.parent.commonName.toLowerCase()}`
					: `Kinds of ${lib.commonName.toLowerCase()}`,
				rows: family.map((k) => libraryRow(k, 0, places, month)),
			};
		}
	}

	const sections = lib
		? (
				[
					['Growing it', lib.growingMd],
					['Looking after it', lib.careMd],
					['Picking', lib.harvestMd],
					['Trouble', lib.problemsMd],
				] as const
			).flatMap(([title, body]) => (body ? [{ title, body }] : []))
		: [];

	return {
		slug,
		commonName: lib?.commonName ?? own!.commonName,
		scientificName: lib?.scientificName ?? own?.scientificName ?? null,
		lifecycle: lib?.lifecycle ?? own!.lifecycle,
		family: lib?.family ?? own?.family ?? null,
		city,
		parent: lib?.parent
			? { slug: lib.parent.slug, commonName: lib.parent.commonName }
			: null,
		// A household's own plant has no article; its notes are the nearest
		// thing, and are what its page has always shown.
		summary: lib ? lib.summary : (own?.notesMd ?? null),
		regionNote: lib?.regionNote ?? null,
		sections,
		citations: lib ? citationsOf(lib.citations) : [],
		daysToMaturityMin: lib?.daysToMaturityMin ?? own?.daysToMaturityMin ?? null,
		daysToMaturityMax: lib?.daysToMaturityMax ?? own?.daysToMaturityMax ?? null,
		spacingCm: lib?.spacingCm ?? own?.spacingCm ?? null,
		needsReview: own?.needsReview ?? lib?.needsReview ?? false,
		when: when_,
		shiftLines: shiftLines(asRules, places),
		kinds,
		inLibrary: Boolean(lib),
		plantTypeId: own?.id ?? null,
		ownSlug: own?.slug ?? null,
		differs,
		findings: lib?.findingsMd ?? null,
		libraryChange:
			own?.libraryChange && own.libraryChangedOn
				? { what: own.libraryChange, on: own.libraryChangedOn }
				: null,
		places: await sowPlaces(hid, lib?.category ?? own!.category),
	};
}
