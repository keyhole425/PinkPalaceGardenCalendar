/** Everything one plant's page needs. */
import { and, asc, count, desc, eq, isNull, ne } from 'drizzle-orm';
import type { IsoDate } from '@/lib/dates';
import { today as todayInGarden } from '@/lib/dates';
import type { EffectiveRule, Occurrence } from '@/lib/schedule/types';
import { db } from '../client';
import { careLog, careRule, environment, planting, plantType } from '../schema';
import type { HarvestSeason } from './garden';
import { getSchedule } from './garden';

export type HistoryEntry = {
	id: number;
	action: string;
	completedOn: string;
	occurrenceKey: string | null;
	quantityNote: string | null;
	notesMd: string | null;
};

export type PlantPlanting = {
	plantingId: number;
	label: string;
	environmentName: string;
	/** Every rule, harvest seasons included - those produce no occurrences. */
	rules: EffectiveRule[];
	occurrences: Occurrence[];
	/** Harvest windows open right now, which can be logged against freely. */
	openSeasons: HarvestSeason[];
	/** Everything ever written down about this plant, newest first. */
	history: HistoryEntry[];
};

export type PlantDetail = {
	id: number;
	slug: string;
	commonName: string;
	scientificName: string | null;
	category: string;
	lifecycle: string;
	family: string | null;
	notesMd: string | null;
	needsReview: boolean;
	sourceRef: string | null;
	plantings: PlantPlanting[];
	/**
	 * The plant's own rules, shown when nothing of it is in the ground - a crop
	 * waiting for its season still has a schedule worth reading.
	 */
	templateRules: ReturnType<typeof getEditableRules>;
};

export function getPlant(
	slug: string,
	when: IsoDate = todayInGarden(),
): PlantDetail | null {
	const row = db.select().from(plantType).where(eq(plantType.slug, slug)).get();
	if (!row) return null;

	// The schedule already resolves overrides and environment shifts for every
	// planting; picking this plant's out of it keeps one code path.
	const schedule = getSchedule(when);

	const plantings: PlantPlanting[] = schedule.plantings
		.filter((p) => p.context.plantTypeId === row.id)
		.map((p) => ({
			plantingId: p.context.plantingId,
			label: p.context.label,
			environmentName: p.context.environment.name,
			rules: [...p.rules].sort((a, b) => a.action.localeCompare(b.action)),
			occurrences: [...p.occurrences].sort((a, b) =>
				a.opensOn.localeCompare(b.opensOn),
			),
			openSeasons: schedule.harvesting.filter(
				(h) => h.context.plantingId === p.context.plantingId,
			),
			history: getHistory(p.context.plantingId),
		}))
		.sort((a, b) => a.label.localeCompare(b.label));

	return {
		id: row.id,
		slug: row.slug,
		commonName: row.commonName,
		scientificName: row.scientificName,
		category: row.category,
		lifecycle: row.lifecycle,
		family: row.family,
		notesMd: row.notesMd,
		needsReview: row.needsReview,
		sourceRef: row.sourceRef,
		plantings,
		templateRules: getEditableRules(row.id),
	};
}

export function listPlantSlugs(): string[] {
	return db
		.select({ slug: plantType.slug })
		.from(plantType)
		.orderBy(asc(plantType.id))
		.all()
		.map((r) => r.slug);
}

/** Everything written down against one plant, newest first. */
export function getHistory(plantingId: number): HistoryEntry[] {
	return db
		.select({
			id: careLog.id,
			action: careLog.action,
			completedOn: careLog.completedOn,
			occurrenceKey: careLog.occurrenceKey,
			quantityNote: careLog.quantityNote,
			notesMd: careLog.notesMd,
		})
		.from(careLog)
		.where(eq(careLog.plantingId, plantingId))
		.orderBy(desc(careLog.completedOn), desc(careLog.id))
		.all();
}

/**
 * A plant's rules as stored, grouped the way the editor works on them: one
 * entry per job, with its alternatives folded in.
 *
 * Unlike the schedule's view these are unshifted and unresolved - the editor
 * edits what is written down, not what a particular environment makes of it.
 */
export function getEditableRules(plantTypeId: number) {
	const rows = db
		.select({
			id: careRule.id,
			action: careRule.action,
			monthMask: careRule.monthMask,
			cadence: careRule.cadence,
			altGroup: careRule.altGroup,
			environmentKind: careRule.environmentKind,
			note: careRule.note,
			source: careRule.source,
			sourceRef: careRule.sourceRef,
			userModifiedAt: careRule.userModifiedAt,
		})
		.from(careRule)
		.where(
			and(
				eq(careRule.plantTypeId, plantTypeId),
				isNull(careRule.plantingId),
				eq(careRule.active, true),
			),
		)
		.orderBy(asc(careRule.id))
		.all();

	const groups = new Map<string, typeof rows>();
	for (const row of rows) {
		const key = row.altGroup ?? `rule:${row.id}`;
		const list = groups.get(key);
		if (list) list.push(row);
		else groups.set(key, [row]);
	}

	return [...groups.values()].map((members) => {
		const first = members[0];
		return {
			ruleIds: members.map((m) => m.id),
			action: first.action,
			monthMask: members.reduce((mask, m) => mask | m.monthMask, 0),
			cadence: first.cadence,
			alternatives: members.length > 1,
			environmentKind: first.environmentKind,
			note: members.find((m) => m.note)?.note ?? null,
			source: first.source,
			sourceRef: first.sourceRef,
			edited: members.some((m) => m.userModifiedAt !== null),
		};
	});
}

/** Whether a rule for this action has been deliberately removed. */
export function getRemovedActions(plantTypeId: number): string[] {
	return db
		.select({ action: careRule.action })
		.from(careRule)
		.where(and(eq(careRule.plantTypeId, plantTypeId), eq(careRule.active, false)))
		.all()
		.map((r) => r.action);
}

export function listEnvironments() {
	return db
		.select()
		.from(environment)
		.orderBy(asc(environment.sortOrder), asc(environment.id))
		.all();
}

/**
 * The catalogue: every kind of plant figgy knows how to grow.
 *
 * `plantingCount` is how many of them you actually have. Without it the page
 * cannot say whether it is describing the world or your garden, which is
 * exactly how it used to read.
 */
export function listPlants() {
	return db
		.select({
			id: plantType.id,
			slug: plantType.slug,
			commonName: plantType.commonName,
			scientificName: plantType.scientificName,
			category: plantType.category,
			lifecycle: plantType.lifecycle,
			needsReview: plantType.needsReview,
			source: plantType.source,
			plantingCount: count(planting.id),
		})
		.from(plantType)
		.leftJoin(
			planting,
			and(eq(planting.plantTypeId, plantType.id), ne(planting.status, 'removed')),
		)
		.groupBy(plantType.id)
		.orderBy(asc(plantType.commonName))
		.all();
}

export function getPlantings(plantTypeId: number) {
	return db
		.select({
			id: planting.id,
			label: planting.label,
			status: planting.status,
			quantity: planting.quantity,
			plantedOn: planting.plantedOn,
			environmentName: environment.name,
		})
		.from(planting)
		.innerJoin(environment, eq(planting.environmentId, environment.id))
		.where(eq(planting.plantTypeId, plantTypeId))
		.orderBy(asc(planting.label))
		.all();
}
