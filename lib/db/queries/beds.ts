/**
 * Beds and the hothouse: what is in them, what was in them, and when what is
 * in them might be ready.
 */
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { type IsoDate, plusDays, today as todayInGarden } from '@/lib/dates';
import { hasMonth, type Month, shiftMask } from '@/lib/schedule/months';
import { db } from '../client';
import { careRule, environment, planting, plantType } from '../schema';

export type BedOccupant = {
	plantingId: number;
	label: string;
	plantSlug: string;
	plantName: string;
	family: string | null;
	posX: number | null;
	posY: number | null;
	sownOn: string | null;
	plantedOn: string | null;
	status: string;
	/** When this might be ready, worked out from the sowing date. */
	readyFrom: IsoDate | null;
	readyTo: IsoDate | null;
};

export type Bed = {
	id: number;
	slug: string;
	name: string;
	kind: string;
	gridCols: number;
	gridRows: number;
	widthCm: number | null;
	lengthCm: number | null;
	frostFree: boolean;
	windowShiftMonths: number;
	notes: string | null;
	occupants: BedOccupant[];
};

/**
 * Sow on the first of the month and a 70-90 day crop is ready somewhere
 * between about ten and thirteen weeks later. It is an estimate off the seed
 * packet, not a promise, and the UI says "about".
 */
function readyRange(
	sownOn: string | null,
	min: number | null,
	max: number | null,
): { from: IsoDate | null; to: IsoDate | null } {
	if (!sownOn || !min) return { from: null, to: null };
	return { from: plusDays(sownOn, min), to: plusDays(sownOn, max ?? min) };
}

function loadOccupants(environmentId: number): BedOccupant[] {
	return db
		.select({
			plantingId: planting.id,
			label: planting.label,
			plantSlug: plantType.slug,
			plantName: plantType.commonName,
			family: plantType.family,
			posX: planting.posX,
			posY: planting.posY,
			sownOn: planting.sownOn,
			plantedOn: planting.plantedOn,
			status: planting.status,
			min: plantType.daysToMaturityMin,
			max: plantType.daysToMaturityMax,
		})
		.from(planting)
		.innerJoin(plantType, eq(planting.plantTypeId, plantType.id))
		.where(
			and(
				eq(planting.environmentId, environmentId),
				ne(planting.status, 'removed'),
			),
		)
		.orderBy(asc(planting.posY), asc(planting.posX), asc(planting.id))
		.all()
		.map((row) => {
			const ready = readyRange(row.sownOn, row.min, row.max);
			return {
				plantingId: row.plantingId,
				label: row.label,
				plantSlug: row.plantSlug,
				plantName: row.plantName,
				family: row.family,
				posX: row.posX,
				posY: row.posY,
				sownOn: row.sownOn,
				plantedOn: row.plantedOn,
				status: row.status,
				readyFrom: ready.from,
				readyTo: ready.to,
			};
		});
}

export function listBeds(): Bed[] {
	return db
		.select()
		.from(environment)
		.where(ne(environment.kind, 'orchard'))
		.orderBy(asc(environment.sortOrder), asc(environment.id))
		.all()
		.map((e) => ({
			id: e.id,
			slug: e.slug,
			name: e.name,
			kind: e.kind,
			// A place with no grid still gets one, so the plan view always works.
			gridCols: e.gridCols ?? 4,
			gridRows: e.gridRows ?? 2,
			widthCm: e.widthCm,
			lengthCm: e.lengthCm,
			frostFree: e.frostFree,
			windowShiftMonths: e.windowShiftMonths,
			notes: e.notes,
			occupants: loadOccupants(e.id),
		}));
}

export function getBed(slug: string): Bed | null {
	const e = db.select().from(environment).where(eq(environment.slug, slug)).get();
	if (!e) return null;
	return {
		id: e.id,
		slug: e.slug,
		name: e.name,
		kind: e.kind,
		gridCols: e.gridCols ?? 4,
		gridRows: e.gridRows ?? 2,
		widthCm: e.widthCm,
		lengthCm: e.lengthCm,
		frostFree: e.frostFree,
		windowShiftMonths: e.windowShiftMonths,
		notes: e.notes,
		occupants: loadOccupants(e.id),
	};
}

export type BedHistoryEntry = {
	plantingId: number;
	label: string;
	plantName: string;
	family: string | null;
	sownOn: string | null;
	removedOn: string | null;
	status: string;
};

/** Everything that has grown here, newest first. */
export function getBedHistory(environmentId: number): BedHistoryEntry[] {
	return db
		.select({
			plantingId: planting.id,
			label: planting.label,
			plantName: plantType.commonName,
			family: plantType.family,
			sownOn: planting.sownOn,
			removedOn: planting.removedOn,
			status: planting.status,
		})
		.from(planting)
		.innerJoin(plantType, eq(planting.plantTypeId, plantType.id))
		.where(eq(planting.environmentId, environmentId))
		.orderBy(desc(planting.id))
		.all();
}

/** How long ago a family should have last been in a bed, in days. */
export const ROTATION_YEARS = 2;

export type RotationWarning = {
	family: string;
	lastSeen: string;
	what: string;
};

/**
 * Crops in the same family take the same things out of the soil and share the
 * same diseases, so putting one back where its cousin just was is asking for
 * trouble. This looks back two years.
 */
export function rotationWarningFor(
	environmentId: number,
	family: string | null,
	when: IsoDate = todayInGarden(),
): RotationWarning | null {
	if (!family) return null;
	const floor = plusDays(when, -365 * ROTATION_YEARS);

	const previous = db
		.select({
			plantName: plantType.commonName,
			family: plantType.family,
			sownOn: planting.sownOn,
			plantedOn: planting.plantedOn,
			removedOn: planting.removedOn,
		})
		.from(planting)
		.innerJoin(plantType, eq(planting.plantTypeId, plantType.id))
		.where(
			and(eq(planting.environmentId, environmentId), eq(plantType.family, family)),
		)
		.orderBy(desc(planting.id))
		.all();

	for (const row of previous) {
		const date = row.removedOn ?? row.sownOn ?? row.plantedOn;
		// A planting with no dates at all is still evidence the family was here.
		if (!date || date >= floor) {
			return {
				family,
				lastSeen: date ?? 'at some point',
				what: row.plantName,
			};
		}
	}
	return null;
}

export type SowSuggestion = {
	plantTypeId: number;
	slug: string;
	commonName: string;
	family: string | null;
	places: { slug: string; name: string; shifted: boolean }[];
};

/**
 * What could go in the ground this month.
 *
 * Every other part of the schedule hangs off something already planted, which
 * is the wrong way round for an annual: figgy cannot tell you to sow beans by
 * looking at the beans you have not sown. So this works from the crops it
 * knows and the places that are open to them, and it applies the same
 * environment shift the engine does - which is why the hothouse shows up here
 * a month before the beds do.
 */
export function sowableThisMonth(when: IsoDate = todayInGarden()): SowSuggestion[] {
	const month = Number(when.slice(5, 7));

	const places = db
		.select()
		.from(environment)
		.where(ne(environment.kind, 'orchard'))
		.orderBy(asc(environment.sortOrder), asc(environment.id))
		.all();
	if (places.length === 0) return [];

	const rules = db
		.select({
			plantTypeId: plantType.id,
			slug: plantType.slug,
			commonName: plantType.commonName,
			family: plantType.family,
			monthMask: careRule.monthMask,
			environmentKind: careRule.environmentKind,
		})
		.from(careRule)
		.innerJoin(plantType, eq(careRule.plantTypeId, plantType.id))
		.where(and(eq(careRule.action, 'sow'), eq(careRule.active, true)))
		.orderBy(asc(plantType.commonName))
		.all();

	const suggestions = new Map<number, SowSuggestion>();

	for (const rule of rules) {
		for (const place of places) {
			// A rule naming this kind of place means what it says; anything else
			// moves with the place.
			const specific = rule.environmentKind === place.kind;
			if (rule.environmentKind && !specific) continue;

			const shift = specific ? 0 : place.windowShiftMonths;
			const effective = shiftMask(rule.monthMask, shift);
			if (!hasMonth(effective, month as Month)) continue;

			const entry = suggestions.get(rule.plantTypeId) ?? {
				plantTypeId: rule.plantTypeId,
				slug: rule.slug,
				commonName: rule.commonName,
				family: rule.family,
				places: [],
			};
			if (!entry.places.some((p) => p.slug === place.slug)) {
				entry.places.push({
					slug: place.slug,
					name: place.name,
					// Only worth saying when the shift is the reason it is open
					// here at all - otherwise the label is on everything and
					// means nothing.
					shifted: shift !== 0 && !hasMonth(rule.monthMask, month as Month),
				});
			}
			suggestions.set(rule.plantTypeId, entry);
		}
	}

	return [...suggestions.values()].sort((a, b) =>
		a.commonName.localeCompare(b.commonName),
	);
}
