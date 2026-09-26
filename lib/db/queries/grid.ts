/**
 * The year grid: every plant, every action, every month.
 *
 * This is deliberately one query and a group-by rather than a query per plant -
 * the whole orchard is a few dozen rows.
 */
import { asc, eq, isNull } from 'drizzle-orm';
import type { IsoDate } from '@/lib/dates';
import { monthOf, today as todayInGarden } from '@/lib/dates';
import type { Month } from '@/lib/schedule/months';
import { db } from '../client';
import type { Cadence, CareAction } from '../schema';
import { careRule, plantType } from '../schema';
import { getSchedule } from './garden';

/** The order the spreadsheet used, and the order the grid shows. */
export const GRID_ACTIONS = ['fertilise', 'prune', 'harvest'] as const;
export type GridAction = (typeof GRID_ACTIONS)[number];

export type GridRule = {
	id: number;
	monthMask: number;
	cadence: Cadence;
	altGroup: string | null;
	note: string | null;
};

export type GridRow = {
	action: GridAction;
	rules: GridRule[];
};

export type GridPlant = {
	id: number;
	slug: string;
	commonName: string;
	scientificName: string | null;
	notesMd: string | null;
	/** The first sentence or so of notesMd. See noteSummary. */
	noteSummary: string | null;
	needsReview: boolean;
	rows: GridRow[];
};

/**
 * The opening of a plant's notes, short enough to sit in a grid cell.
 *
 * The grid puts this in a row-spanning header, so an unabridged note sets the
 * height of every row for that plant: Plum's is 2,526 characters, which made
 * its row 1,312px tall against about 157px for everything else. The full text
 * is a click away on the plant's own page.
 */
export function noteSummary(notes: string | null): string | null {
	if (!notes) return null;
	const flat = notes.replace(/\s+/g, ' ').trim();
	if (!flat) return null;

	// The first sentence, as long as it is actually a sentence and not an
	// abbreviation a few characters in.
	const stop = flat.slice(40).search(/[.!?](\s|$)|\u2014/);
	const firstSentence = stop === -1 ? flat : flat.slice(0, 40 + stop + 1);

	if (firstSentence.length <= 120) {
		return firstSentence === flat ? flat : `${firstSentence.trim()}\u2026`;
	}

	// Still too long: cut at a word boundary instead.
	const cut = flat.slice(0, 120).lastIndexOf(' ');
	return `${flat.slice(0, cut === -1 ? 120 : cut).trim()}\u2026`;
}

export function getGrid(): GridPlant[] {
	const plants = db
		.select({
			id: plantType.id,
			slug: plantType.slug,
			commonName: plantType.commonName,
			scientificName: plantType.scientificName,
			notesMd: plantType.notesMd,
			needsReview: plantType.needsReview,
		})
		.from(plantType)
		.orderBy(asc(plantType.id))
		.all();

	const rules = db
		.select({
			id: careRule.id,
			plantTypeId: careRule.plantTypeId,
			action: careRule.action,
			monthMask: careRule.monthMask,
			cadence: careRule.cadence,
			altGroup: careRule.altGroup,
			note: careRule.note,
		})
		.from(careRule)
		// Template rules only. Per-planting overrides belong on a planting's own
		// page, not in the plant-level year view.
		.where(isNull(careRule.plantingId))
		.orderBy(asc(careRule.id))
		.all();

	const byPlant = new Map<number, typeof rules>();
	for (const rule of rules) {
		if (rule.plantTypeId === null) continue;
		const list = byPlant.get(rule.plantTypeId);
		if (list) {
			list.push(rule);
		} else {
			byPlant.set(rule.plantTypeId, [rule]);
		}
	}

	return plants.map((plant) => {
		const mine = byPlant.get(plant.id) ?? [];
		return {
			...plant,
			noteSummary: noteSummary(plant.notesMd),
			// Every plant shows all three action rows, even when empty - an empty
			// row is information: nobody has said what this tree needs.
			rows: GRID_ACTIONS.map((action) => ({
				action,
				rules: mine
					.filter((r) => r.action === action)
					.map(({ id, monthMask, cadence, altGroup, note }) => ({
						id,
						monthMask,
						cadence,
						altGroup,
						note,
					})),
			})),
		};
	});
}

export function countPlantsNeedingReview(): number {
	return db
		.select({ id: plantType.id })
		.from(plantType)
		.where(eq(plantType.needsReview, true))
		.all().length;
}

export type { CareAction };

/**
 * Which cells to tick.
 *
 * The grid is a view of plant *types*, but work is done to individual plants -
 * there are two cherries, and pruning one of them is not pruning both. A cell
 * is only fully ticked when every plant of that type has been done; do one of
 * two and it shows as partial.
 *
 * The tick lands on the month the work actually happened, which is not always
 * the month it was due: pruning in September something that was due in August
 * should read as September.
 */
export type CellMark = { done: number; total: number };

export function getGridMarks(
	when: IsoDate = todayInGarden(),
): Map<string, CellMark> {
	const { plantings } = getSchedule(when);
	const marks = new Map<string, CellMark>();

	// Only the last twelve months count, so the grid shows this year round,
	// not every tick since the garden was planted.
	const floor = shiftIso(when, -365);

	const totals = new Map<string, number>();
	for (const p of plantings) {
		for (const rule of p.rules) {
			const key = `${p.context.plantTypeId}:${rule.action}`;
			totals.set(key, (totals.get(key) ?? 0) + 1);
		}
	}

	for (const p of plantings) {
		for (const occurrence of p.occurrences) {
			if (occurrence.state !== 'done' || !occurrence.completedOn) continue;
			if (occurrence.completedOn < floor) continue;

			const month = monthOf(occurrence.completedOn);
			const cell = `${p.context.plantTypeId}:${occurrence.rule.action}:${month}`;
			const existing = marks.get(cell);
			marks.set(cell, {
				done: (existing?.done ?? 0) + 1,
				total:
					totals.get(`${p.context.plantTypeId}:${occurrence.rule.action}`) ?? 1,
			});
		}
	}

	return marks;
}

export function cellKey(plantTypeId: number, action: string, month: Month): string {
	return `${plantTypeId}:${action}:${month}`;
}

function shiftIso(date: IsoDate, days: number): IsoDate {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}
