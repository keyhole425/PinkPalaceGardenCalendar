/**
 * Changing the library, and carrying the change to every garden.
 *
 * Only a site admin gets here (actions/library.ts checks, from the
 * database). Anything written is `curated`, so the seed leaves it alone
 * from then on, and every change bumps the plant's revision and runs the
 * same sync seeding does for each household with a copy: an untouched copy
 * follows, an edited one keeps what is its own.
 */
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { opaqueKeys } from '@/lib/crypto/secretbox';
import type { Db, Tx } from '@/lib/db/client';
import {
	household,
	libraryPlant,
	libraryRegionNote,
	libraryRule,
	plantType,
	type RegionId,
} from '@/lib/db/schema';
import { asHouseholdId, type HouseholdId } from '@/lib/db/tenancy';
import { maskFromMonths } from '@/lib/schedule/months';
import { loadResolved, type ResolvedPlant } from './resolve';
import type { NewPlantPayload, SuggestedRule } from './suggestions';
import { followLibrary } from './sync';

function now() {
	return new Date().toISOString();
}

/** One action's library rules, in one region, replaced by these months. */
export async function replaceRules(
	db: Db | Tx,
	plant: { id: number; slug: string },
	region: RegionId,
	action: string,
	rule: SuggestedRule | null,
): Promise<void> {
	await db
		.delete(libraryRule)
		.where(
			and(
				eq(libraryRule.libraryPlantId, plant.id),
				eq(libraryRule.region, region),
				eq(
					libraryRule.action,
					action as (typeof libraryRule.$inferInsert)['action'],
				),
			),
		)
		.run();
	const sets = rule?.months.filter((m) => m.length > 0) ?? [];
	if (sets.length === 0) return;
	const choice = sets.length > 1;
	await db
		.insert(libraryRule)
		.values(
			sets.map((months) => ({
				libraryPlantId: plant.id,
				region,
				action: action as (typeof libraryRule.$inferInsert)['action'],
				monthMask: maskFromMonths(months),
				cadence: choice ? ('once_in_window' as const) : ('monthly' as const),
				altGroup: choice ? `${plant.slug}:${action}` : null,
				environmentKind: (rule?.environmentKind ??
					null) as (typeof libraryRule.$inferInsert)['environmentKind'],
				source: 'curated' as const,
				sourceRef: 'Curated',
				curatedAt: now(),
			})),
		)
		.run();
}

/** Marks a plant changed: curated, and one revision on. */
export async function revise(db: Db | Tx, libraryPlantId: number): Promise<void> {
	const row = await db
		.select({ revision: libraryPlant.revision })
		.from(libraryPlant)
		.where(eq(libraryPlant.id, libraryPlantId))
		.get();
	if (!row) return;
	await db
		.update(libraryPlant)
		.set({ revision: row.revision + 1, curatedAt: now(), source: 'curated' })
		.where(eq(libraryPlant.id, libraryPlantId))
		.run();
}

/**
 * Every household copy of this plant, or of one of its kinds - a change to
 * the chilli reaches every habanero - brought up to date.
 */
export async function carryToGardens(
	db: Db | Tx,
	libraryPlantId: number,
): Promise<number> {
	const kinds = await db
		.select({ id: libraryPlant.id })
		.from(libraryPlant)
		.where(
			or(
				eq(libraryPlant.id, libraryPlantId),
				eq(libraryPlant.parentId, libraryPlantId),
			),
		)
		.all();
	const copies = await db
		.select({
			householdId: plantType.householdId,
			region: household.region,
			slug: libraryPlant.slug,
		})
		.from(plantType)
		.innerJoin(household, eq(plantType.householdId, household.id))
		.innerJoin(libraryPlant, eq(plantType.libraryPlantId, libraryPlant.id))
		.where(
			inArray(
				plantType.libraryPlantId,
				kinds.map((k) => k.id),
			),
		)
		.all();
	const resolved = new Map<string, ResolvedPlant>();
	for (const copy of copies) {
		const key = `${copy.region}:${copy.slug}`;
		if (!resolved.has(key)) {
			const [plant] = await loadResolved(db, [copy.slug], copy.region);
			if (plant) resolved.set(key, plant);
		}
		const plant = resolved.get(key);
		if (plant) await followLibrary(db, asHouseholdId(copy.householdId), plant);
	}
	return copies.length;
}

/** revise() then carryToGardens(): what every curator change ends with. */
export async function publish(
	db: Db | Tx,
	libraryPlantId: number,
): Promise<number> {
	await revise(db, libraryPlantId);
	return await carryToGardens(db, libraryPlantId);
}

function slugify(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[’']/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
}

async function freeSlug(db: Db | Tx, name: string): Promise<string> {
	const base = slugify(name) || 'plant';
	let slug = base;
	for (let n = 2; ; n++) {
		const taken = await db
			.select({ id: libraryPlant.id })
			.from(libraryPlant)
			.where(eq(libraryPlant.slug, slug))
			.get();
		if (!taken) return slug;
		slug = `${base}-${n}`;
	}
}

/**
 * A garden's plant, made a library plant - or, with a parent, a kind of
 * one. A kind keeps only what differs from its parent, field by field and
 * action by action, so the parent's later corrections still reach it.
 */
export async function addToLibrary(
	db: Db | Tx,
	payload: NewPlantPayload,
	region: RegionId,
	parentId: number | null,
): Promise<{ id: number; slug: string }> {
	const parent = parentId
		? (
				await loadResolved(
					db,
					[
						(
							await db
								.select({ slug: libraryPlant.slug })
								.from(libraryPlant)
								.where(
									and(eq(libraryPlant.id, parentId), isNull(libraryPlant.parentId)),
								)
								.get()
						)?.slug ?? '',
					],
					region,
				)
			)[0]
		: undefined;
	if (parentId && !parent) throw new Error('That plant cannot have kinds.');

	const differs = <T>(mine: T | null, theirs: T | null | undefined): T | null =>
		parent && mine === (theirs ?? null) ? null : mine;

	const slug = await freeSlug(db, payload.commonName);
	const id = (
		await db
			.insert(libraryPlant)
			.values({
				slug,
				parentId: parent?.id ?? null,
				commonName: payload.commonName,
				scientificName: differs(payload.scientificName, parent?.scientificName),
				category: parent ? null : payload.category,
				lifecycle: parent
					? differs(payload.lifecycle, parent.lifecycle)
					: payload.lifecycle,
				family: differs(payload.family, parent?.family),
				daysToMaturityMin: differs(
					payload.daysToMaturityMin,
					parent?.daysToMaturityMin,
				),
				daysToMaturityMax: differs(
					payload.daysToMaturityMax,
					parent?.daysToMaturityMax,
				),
				spacingCm: differs(payload.spacingCm, parent?.spacingCm),
				summary: payload.notesMd,
				citations:
					payload.citations.length > 0 ? JSON.stringify(payload.citations) : null,
				source: 'curated',
				sourceRef: 'From a garden',
				curatedAt: now(),
			})
			.returning({ id: libraryPlant.id })
			.get()
	).id;

	for (const rule of payload.rules) {
		const theirs = parent?.rules.filter((r) => r.action === rule.action) ?? [];
		const same =
			theirs.length > 0 &&
			JSON.stringify(rule.months.map((m) => maskFromMonths(m)).sort()) ===
				JSON.stringify(theirs.map((r) => r.monthMask).sort());
		if (!same) await replaceRules(db, { id, slug }, region, rule.action, rule);
	}
	return { id, slug };
}

/**
 * Finds the household plant a suggestion came from, by its anonymous key,
 * and makes it a copy of `libraryPlantId`. Its fields and rules are counted
 * as its own, so nothing about it changes on the day. Its grows teach the
 * library from then on, the ones it has already had included: the caller
 * runs contributePlant() once its transaction is done.
 */
export async function linkSubject(
	db: Db | Tx,
	subject: string,
	libraryPlantId: number,
): Promise<{ hid: HouseholdId; plantTypeId: number } | null> {
	const candidates = await db
		.select({ id: plantType.id, householdId: plantType.householdId })
		.from(plantType)
		.where(isNull(plantType.libraryPlantId))
		.all();
	const found = candidates.find((c) =>
		opaqueKeys(`plant:${c.id}`).includes(subject),
	);
	if (!found) return null;
	const lib = await db
		.select({ revision: libraryPlant.revision })
		.from(libraryPlant)
		.where(eq(libraryPlant.id, libraryPlantId))
		.get();
	const row = await db
		.select({ userModifiedAt: plantType.userModifiedAt })
		.from(plantType)
		.where(eq(plantType.id, found.id))
		.get();
	await db
		.update(plantType)
		.set({
			libraryPlantId,
			libraryRevision: lib?.revision ?? null,
			userModifiedAt: row?.userModifiedAt ?? now(),
		})
		.where(eq(plantType.id, found.id))
		.run();
	return { hid: asHouseholdId(found.householdId), plantTypeId: found.id };
}

/** The region note a site admin wrote, or none. */
export async function setRegionNote(
	db: Db | Tx,
	libraryPlantId: number,
	region: RegionId,
	noteMd: string | null,
): Promise<void> {
	await db
		.delete(libraryRegionNote)
		.where(
			and(
				eq(libraryRegionNote.libraryPlantId, libraryPlantId),
				eq(libraryRegionNote.region, region),
			),
		)
		.run();
	if (noteMd) {
		await db
			.insert(libraryRegionNote)
			.values({
				libraryPlantId,
				region,
				noteMd,
				source: 'curated',
				curatedAt: now(),
			})
			.run();
	}
}
