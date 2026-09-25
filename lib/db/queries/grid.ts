/**
 * The year grid: every plant, every action, every month.
 *
 * This is deliberately one query and a group-by rather than a query per plant -
 * the whole orchard is a few dozen rows.
 */
import { asc, eq, isNull } from 'drizzle-orm';
import { db } from '../client';
import type { Cadence, CareAction } from '../schema';
import { careRule, plantType } from '../schema';

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
	needsReview: boolean;
	rows: GridRow[];
};

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
