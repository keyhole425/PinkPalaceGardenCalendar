/** Everything one plant's page needs. */
import { asc, eq } from 'drizzle-orm';
import type { IsoDate } from '@/lib/dates';
import { today as todayInGarden } from '@/lib/dates';
import type { EffectiveRule, Occurrence } from '@/lib/schedule/types';
import { db } from '../client';
import { plantType } from '../schema';
import { getSchedule } from './garden';

export type PlantPlanting = {
	plantingId: number;
	label: string;
	environmentName: string;
	/** Every rule, harvest seasons included - those produce no occurrences. */
	rules: EffectiveRule[];
	occurrences: Occurrence[];
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
