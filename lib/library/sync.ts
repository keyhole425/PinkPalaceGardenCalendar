/**
 * Keeping a household's copies in step with where they came from.
 *
 * A household's plant is either its own or a copy - of the seed (the
 * orchard, written from the Pink Palace's spreadsheet) or of the library.
 * A copy follows its source until someone edits it, and the rule that makes
 * that safe is the one seeding has always kept: only touch what the source
 * still owns. A rule is the source's while it carries that source and nobody
 * has edited it. The moment you change a plant's pruning, pruning becomes
 * yours - the source stops deleting it *and* stops writing its own version
 * back, so following never resurrects what you replaced.
 *
 * The other half: a rule that has not changed is left exactly where it is.
 * What you did is recorded against a rule's id, so deleting and re-inserting
 * every rule - which seeding once did - quietly un-ticked every job on every
 * re-seed. Only a rule the source no longer has is removed, and only one it
 * did not have before is added.
 */
import { and, eq, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm';
import { today } from '@/lib/dates';
import type { Db, Tx } from '@/lib/db/client';
import { deleteRules } from '@/lib/db/rules';
import { careRule, plantType } from '@/lib/db/schema';
import { type HouseholdId, owns } from '@/lib/db/tenancy';
import { ACTION_LABEL } from '@/lib/ui/actions';
import { windowText } from './describe';
import type { ResolvedPlant } from './resolve';

/** Which source a set of rules is being followed from. */
export type RuleOwner = 'seed' | 'library';

type RuleInsert = typeof careRule.$inferInsert;

/**
 * Which actions a person has taken charge of for this plant.
 *
 * Anything not written by the source, or written by it and since edited,
 * counts - including a tombstone, the disabled row left behind when a rule is
 * deleted, which is how "this tree needs no pruning" survives.
 */
export async function userOwnedActions(
	db: Db | Tx,
	hid: HouseholdId,
	plantTypeId: number,
	owner: RuleOwner,
): Promise<Set<string>> {
	const rows = await db
		.select({ action: careRule.action })
		.from(careRule)
		.where(
			and(
				owns(careRule, hid),
				eq(careRule.plantTypeId, plantTypeId),
				or(ne(careRule.source, owner), isNotNull(careRule.userModifiedAt)),
			),
		)
		.all();
	return new Set(rows.map((r) => r.action));
}

/** What makes two rules the same rule, as far as following is concerned. */
export function ruleKey(r: {
	action: string;
	monthMask: number;
	cadence?: string | null;
	altGroup?: string | null;
	environmentKind?: string | null;
	label?: string | null;
	note?: string | null;
	sourceRef?: string | null;
}): string {
	return JSON.stringify([
		r.action,
		r.monthMask,
		r.cadence ?? null,
		r.altGroup ?? null,
		r.environmentKind ?? null,
		r.label ?? null,
		r.note ?? null,
		r.sourceRef ?? null,
	]);
}

/**
 * Brings the rules `owner` still owns for one plant in line with `wanted`,
 * skipping every action someone here has taken charge of.
 */
export async function followRules(
	db: Db | Tx,
	hid: HouseholdId,
	plantTypeId: number,
	owner: RuleOwner,
	wanted: RuleInsert[],
): Promise<{ written: number; owned: string[]; changed: string[] }> {
	const owned = await userOwnedActions(db, hid, plantTypeId, owner);
	const sourceOwned = and(
		owns(careRule, hid),
		eq(careRule.plantTypeId, plantTypeId),
		eq(careRule.source, owner),
		isNull(careRule.userModifiedAt),
	);

	const existing = await db
		.select({
			id: careRule.id,
			action: careRule.action,
			monthMask: careRule.monthMask,
			cadence: careRule.cadence,
			altGroup: careRule.altGroup,
			environmentKind: careRule.environmentKind,
			label: careRule.label,
			note: careRule.note,
			sourceRef: careRule.sourceRef,
		})
		.from(careRule)
		.where(sourceOwned)
		.all();
	const unclaimed = new Map<string, number[]>();
	for (const rule of existing) {
		const key = ruleKey(rule);
		unclaimed.set(key, [...(unclaimed.get(key) ?? []), rule.id]);
	}

	const toInsert = wanted
		.filter((r) => !owned.has(r.action))
		.filter((rule) => {
			const ids = unclaimed.get(ruleKey(rule));
			if (ids && ids.length > 0) {
				ids.shift();
				return false;
			}
			return true;
		});
	const stale = [...unclaimed.values()].flat();
	const changed = new Set([
		...toInsert.map((r) => r.action),
		...existing.filter((r) => stale.includes(r.id)).map((r) => r.action),
	]);

	if (stale.length > 0) {
		await deleteRules(db, and(sourceOwned, inArray(careRule.id, stale)));
	}
	if (toInsert.length > 0) await db.insert(careRule).values(toInsert).run();
	return { written: toInsert.length, owned: [...owned], changed: [...changed] };
}

/** "sow Sep–Nov, harvest Feb–May": what following changed, for the article. */
function describeChange(plant: ResolvedPlant, actions: string[]): string {
	return actions
		.map((action) => {
			const these = plant.rules.filter((r) => r.action === action);
			const label = (ACTION_LABEL[action] ?? action).toLowerCase();
			return these.length > 0
				? `${label} ${windowText(these)}`
				: `no more ${label}`;
		})
		.join(', ');
}

/** What a household's plant row says when it is a copy of the library's. */
export function copyFields(plant: ResolvedPlant) {
	return {
		commonName: plant.commonName,
		scientificName: plant.scientificName,
		category: plant.category,
		lifecycle: plant.lifecycle,
		family: plant.family,
		// The household's notes are the article's opening and what it says
		// about this region, which is what the year grid and the plant page
		// have always shown.
		notesMd: [plant.summary, plant.regionNote].filter(Boolean).join('\n\n') || null,
		needsReview: plant.needsReview,
		daysToMaturityMin: plant.daysToMaturityMin,
		daysToMaturityMax: plant.daysToMaturityMax,
		spacingCm: plant.spacingCm,
		rowSpacingCm: plant.rowSpacingCm,
		source: 'library' as const,
		sourceRef: 'Library',
		libraryPlantId: plant.id,
		libraryRevision: plant.revision,
	};
}

/** Where a copied rule says it came from: the plant it is written on. */
function librarySourceRef(from: string, action: string): string {
	return `Library / ${from} / ${action}`;
}

/** The household's rules a library plant becomes. */
export function copyRules(
	hid: HouseholdId,
	plantTypeId: number,
	plant: ResolvedPlant,
): RuleInsert[] {
	return plant.rules.map((rule) => ({
		householdId: hid,
		plantTypeId,
		action: rule.action,
		monthMask: rule.monthMask,
		cadence: rule.cadence,
		altGroup: rule.altGroup,
		environmentKind: rule.environmentKind,
		label: rule.label,
		note: rule.note,
		source: 'library' as const,
		sourceRef: librarySourceRef(rule.from, rule.action),
	}));
}

export type FollowReport = {
	/** Null when the slug is taken by a plant of the household's own. */
	plantTypeId: number | null;
	created: boolean;
	rules: number;
	/** What was left alone because it is the household's now. */
	leftAlone: string[];
};

/**
 * A seed-made copy from before there was a library: the same plant, written
 * from the same catalogue, just not linked. Linking it in place keeps its id,
 * its plantings and, by giving its untouched rules the library's source and
 * reference, every tick against them.
 */
async function linkSeededCopy(
	db: Db | Tx,
	hid: HouseholdId,
	plant: ResolvedPlant,
): Promise<number | null> {
	const copy = await db
		.select({ id: plantType.id })
		.from(plantType)
		.where(
			and(
				owns(plantType, hid),
				eq(plantType.slug, plant.slug),
				eq(plantType.source, 'seed'),
				isNull(plantType.libraryPlantId),
			),
		)
		.get();
	if (!copy) return null;

	await db
		.update(plantType)
		.set({
			libraryPlantId: plant.id,
			source: 'library',
			sourceRef: 'Library',
		})
		.where(and(owns(plantType, hid), eq(plantType.id, copy.id)))
		.run();

	const untouched = await db
		.select({ id: careRule.id, action: careRule.action })
		.from(careRule)
		.where(
			and(
				owns(careRule, hid),
				eq(careRule.plantTypeId, copy.id),
				eq(careRule.source, 'seed'),
				isNull(careRule.userModifiedAt),
			),
		)
		.all();
	for (const rule of untouched) {
		await db
			.update(careRule)
			.set({
				source: 'library',
				sourceRef: librarySourceRef(plant.commonName, rule.action),
			})
			.where(eq(careRule.id, rule.id))
			.run();
	}
	return copy.id;
}

/**
 * Brings this household's copy of a library plant up to date, making it if
 * there is none. Fields follow while nobody here has edited the plant; rules
 * follow action by action, as above.
 */
export async function followLibrary(
	db: Db | Tx,
	hid: HouseholdId,
	plant: ResolvedPlant,
): Promise<FollowReport> {
	const report: FollowReport = {
		plantTypeId: null,
		created: false,
		rules: 0,
		leftAlone: [],
	};

	const linked = await db
		.select({
			id: plantType.id,
			userModifiedAt: plantType.userModifiedAt,
			libraryRevision: plantType.libraryRevision,
		})
		.from(plantType)
		.where(and(owns(plantType, hid), eq(plantType.libraryPlantId, plant.id)))
		.get();

	let plantTypeId = linked?.id ?? (await linkSeededCopy(db, hid, plant));
	let edited = Boolean(linked?.userModifiedAt);

	if (plantTypeId === null) {
		const clash = await db
			.select({ id: plantType.id })
			.from(plantType)
			.where(and(owns(plantType, hid), eq(plantType.slug, plant.slug)))
			.get();
		if (clash) {
			// Something of the household's own already has this name. It is
			// theirs; the library does not get to take it over.
			report.leftAlone.push(plant.slug);
			return report;
		}
		plantTypeId = (
			await db
				.insert(plantType)
				.values({ householdId: hid, slug: plant.slug, ...copyFields(plant) })
				.returning({ id: plantType.id })
				.get()
		).id;
		report.created = true;
	} else if (!linked) {
		// Just linked: whether it was edited is on the row itself.
		const row = await db
			.select({ userModifiedAt: plantType.userModifiedAt })
			.from(plantType)
			.where(eq(plantType.id, plantTypeId))
			.get();
		edited = Boolean(row?.userModifiedAt);
	}
	report.plantTypeId = plantTypeId;

	if (edited) {
		report.leftAlone.push(plant.slug);
	} else if (!report.created) {
		await db
			.update(plantType)
			.set(copyFields(plant))
			.where(and(owns(plantType, hid), eq(plantType.id, plantTypeId)))
			.run();
	}

	const rules = await followRules(
		db,
		hid,
		plantTypeId,
		'library',
		copyRules(hid, plantTypeId, plant),
	);
	report.rules = rules.written;
	for (const action of rules.owned)
		report.leftAlone.push(`${plant.slug}:${action}`);

	// A copy that already followed an older revision, whose months have just
	// moved: say so on its page, rather than a window shifting without a word.
	if (
		linked &&
		linked.libraryRevision !== null &&
		linked.libraryRevision !== plant.revision &&
		rules.changed.length > 0
	) {
		await db
			.update(plantType)
			.set({
				libraryChange: describeChange(plant, rules.changed),
				libraryChangedOn: today(),
				libraryRevision: plant.revision,
			})
			.where(and(owns(plantType, hid), eq(plantType.id, plantTypeId)))
			.run();
	} else if (linked && edited && linked.libraryRevision !== plant.revision) {
		// Its fields are its own, but it has seen this revision.
		await db
			.update(plantType)
			.set({ libraryRevision: plant.revision })
			.where(and(owns(plantType, hid), eq(plantType.id, plantTypeId)))
			.run();
	}
	return report;
}
