/**
 * What the chat is allowed to look at.
 *
 * Every tool here reads. None of them writes, and none of them takes a string
 * that reaches SQL - they take enumerated arguments and run fixed queries. A
 * confused question can therefore be unhelpful, but it cannot damage anything,
 * which is the whole reason the chat is built this way rather than as a
 * general query interface.
 */
import { asc, desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { type IsoDate, today as todayInGarden } from '@/lib/dates';
import { db } from '@/lib/db/client';
import { listBeds, sowableThisMonth } from '@/lib/db/queries/beds';
import { getDashboard, getSchedule } from '@/lib/db/queries/garden';
import { getEditableRules } from '@/lib/db/queries/plant';
import { careLog, environment, planting, plantType } from '@/lib/db/schema';
import { monthsFromMask } from '@/lib/schedule/months';

export const askToolSchemas = {
	list_plants: z.object({}),
	whats_due: z.object({
		on: z
			.string()
			.describe('A date as YYYY-MM-DD. Leave empty for today.')
			.optional(),
	}),
	plant_schedule: z.object({
		slug: z.string().describe('The plant slug, from list_plants.'),
	}),
	plant_history: z.object({
		slug: z.string().describe('The plant slug, from list_plants.'),
		limit: z.number().int().min(1).max(200).optional(),
	}),
	list_beds: z.object({}),
	what_to_sow: z.object({
		on: z.string().describe('A date as YYYY-MM-DD.').optional(),
	}),
} as const;

export function listPlants() {
	return db
		.select({
			slug: plantType.slug,
			name: plantType.commonName,
			category: plantType.category,
			family: plantType.family,
		})
		.from(plantType)
		.orderBy(asc(plantType.commonName))
		.all();
}

export function whatsDue(on?: string) {
	const when = (on || todayInGarden()) as IsoDate;
	const board = getDashboard(when);
	const describe = (list: typeof board.due) =>
		list.map((t) => ({
			plant: t.context.label,
			action: t.occurrence.rule.action,
			window: `${t.occurrence.opensOn} to ${t.occurrence.closesOn}`,
		}));

	return {
		date: when,
		overdue: describe(board.overdue),
		due: describe(board.due),
		upcoming: describe(board.upcoming),
		harvesting: board.harvesting.map((h) => ({
			plant: h.context.label,
			until: h.closesOn,
		})),
	};
}

export function plantSchedule(slug: string) {
	const plant = db.select().from(plantType).where(eq(plantType.slug, slug)).get();
	if (!plant) return { error: `No plant with the slug "${slug}".` };

	return {
		name: plant.commonName,
		scientificName: plant.scientificName,
		notes: plant.notesMd,
		rules: getEditableRules(plant.id).map((r) => ({
			action: r.action,
			months: monthsFromMask(r.monthMask),
			alternatives: r.alternatives,
			cadence: r.cadence,
			note: r.note,
		})),
		growing: db
			.select({
				label: planting.label,
				place: environment.name,
				status: planting.status,
				sownOn: planting.sownOn,
			})
			.from(planting)
			.innerJoin(environment, eq(planting.environmentId, environment.id))
			.where(eq(planting.plantTypeId, plant.id))
			.all(),
	};
}

export function plantHistory(slug: string, limit = 50) {
	const plant = db.select().from(plantType).where(eq(plantType.slug, slug)).get();
	if (!plant) return { error: `No plant with the slug "${slug}".` };

	return {
		name: plant.commonName,
		entries: db
			.select({
				label: planting.label,
				action: careLog.action,
				completedOn: careLog.completedOn,
				quantity: careLog.quantityNote,
				note: careLog.notesMd,
			})
			.from(careLog)
			.innerJoin(planting, eq(careLog.plantingId, planting.id))
			.where(eq(planting.plantTypeId, plant.id))
			.orderBy(desc(careLog.completedOn))
			.limit(limit)
			.all(),
	};
}

export function beds() {
	return listBeds().map((b) => ({
		name: b.name,
		kind: b.kind,
		frostFree: b.frostFree,
		runsAheadByMonths: -b.windowShiftMonths,
		growing: b.occupants.map((o) => ({
			what: o.plantName,
			family: o.family,
			sownOn: o.sownOn,
			readyFrom: o.readyFrom,
			readyTo: o.readyTo,
		})),
	}));
}

export function whatToSow(on?: string) {
	const when = (on || todayInGarden()) as IsoDate;
	return {
		date: when,
		crops: sowableThisMonth(when).map((c) => ({
			what: c.commonName,
			places: c.places.map((p) => p.name),
			broughtForward: c.places.some((p) => p.shifted),
		})),
	};
}

/** Every planting figgy knows, for questions about the garden as a whole. */
export function gardenSummary() {
	const schedule = getSchedule();
	return {
		today: schedule.today,
		plantings: db
			.select({
				label: planting.label,
				plant: plantType.commonName,
				place: environment.name,
				status: planting.status,
			})
			.from(planting)
			.innerJoin(plantType, eq(planting.plantTypeId, plantType.id))
			.innerJoin(environment, eq(planting.environmentId, environment.id))
			.where(ne(planting.status, 'removed'))
			.all(),
	};
}
