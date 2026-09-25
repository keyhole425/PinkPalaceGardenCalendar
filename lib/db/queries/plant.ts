/** Everything one plant's page needs. */
import { asc, desc, eq } from 'drizzle-orm';
import type { IsoDate } from '@/lib/dates';
import { today as todayInGarden } from '@/lib/dates';
import type { EffectiveRule, Occurrence } from '@/lib/schedule/types';
import { db } from '../client';
import { careLog, plantType } from '../schema';
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
