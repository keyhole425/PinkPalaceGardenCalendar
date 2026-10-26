/** Everything one plant's page needs. */
import { and, asc, count, desc, eq, isNull, ne } from 'drizzle-orm';
import type { IsoDate } from '@/lib/dates';
import { today as todayInGarden } from '@/lib/dates';
import type { EffectiveRule, Occurrence } from '@/lib/schedule/types';
import { db } from '../client';
import {
	aiProposal,
	careLog,
	careRule,
	environment,
	planting,
	plantType,
} from '../schema';
import { type HouseholdId, owns } from '../tenancy';
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
	/**
	 * The look-up a plant Claude added came from, whose page lists every source
	 * it read. Null for anything figgy started with or someone typed in: those
	 * have no source worth showing.
	 */
	lookedUpIn: number | null;
	plantings: PlantPlanting[];
	/**
	 * The plant's own rules, shown when nothing of it is in the ground - a crop
	 * waiting for its season still has a schedule worth reading.
	 */
	templateRules: Awaited<ReturnType<typeof getEditableRules>>;
};

export async function getPlant(
	hid: HouseholdId,
	slug: string,
	when: IsoDate = todayInGarden(),
): Promise<PlantDetail | null> {
	const row = await db
		.select()
		.from(plantType)
		.where(and(owns(plantType, hid), eq(plantType.slug, slug)))
		.get();
	if (!row) return null;

	// The schedule already resolves overrides and environment shifts for every
	// planting; picking this plant's out of it keeps one code path.
	const schedule = await getSchedule(hid, when);

	const plantings: PlantPlanting[] = (
		await Promise.all(
			schedule.plantings
				.filter((p) => p.context.plantTypeId === row.id)
				.map(async (p) => ({
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
					history: await getHistory(hid, p.context.plantingId),
				})),
		)
	).sort((a, b) => a.label.localeCompare(b.label));

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
		lookedUpIn: row.source === 'ai' ? await acceptedProposal(hid, row.id) : null,
		plantings,
		templateRules: await getEditableRules(hid, row.id),
	};
}

async function acceptedProposal(
	hid: HouseholdId,
	plantTypeId: number,
): Promise<number | null> {
	const found = await db
		.select({ id: aiProposal.id })
		.from(aiProposal)
		.where(
			and(
				owns(aiProposal, hid),
				eq(aiProposal.plantTypeId, plantTypeId),
				eq(aiProposal.status, 'accepted'),
			),
		)
		.orderBy(desc(aiProposal.id))
		.get();
	return found?.id ?? null;
}

/**
 * The pages a looked-up rule came from. Accepting a proposal writes them into
 * the rule's reference after the model and proposal, so they are read back
 * out of it rather than stored twice.
 */
function sourcesIn(sourceRef: string | null): string[] {
	return sourceRef?.match(/https?:\/\/\S+/g) ?? [];
}

/** Everything written down against one plant, newest first. */
export async function getHistory(
	hid: HouseholdId,
	plantingId: number,
): Promise<HistoryEntry[]> {
	return await db
		.select({
			id: careLog.id,
			action: careLog.action,
			completedOn: careLog.completedOn,
			occurrenceKey: careLog.occurrenceKey,
			quantityNote: careLog.quantityNote,
			notesMd: careLog.notesMd,
		})
		.from(careLog)
		.where(and(owns(careLog, hid), eq(careLog.plantingId, plantingId)))
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
export async function getEditableRules(hid: HouseholdId, plantTypeId: number) {
	const rows = await db
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
				owns(careRule, hid),
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
			sources: first.source === 'ai' ? sourcesIn(first.sourceRef) : [],
			edited: members.some((m) => m.userModifiedAt !== null),
		};
	});
}

/** Whether a rule for this action has been deliberately removed. */
export async function getRemovedActions(
	hid: HouseholdId,
	plantTypeId: number,
): Promise<string[]> {
	return (
		await db
			.select({ action: careRule.action })
			.from(careRule)
			.where(
				and(
					owns(careRule, hid),
					eq(careRule.plantTypeId, plantTypeId),
					eq(careRule.active, false),
				),
			)
			.all()
	).map((r) => r.action);
}

export async function listEnvironments(hid: HouseholdId) {
	return await db
		.select()
		.from(environment)
		.where(owns(environment, hid))
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
export async function listPlants(hid: HouseholdId) {
	return await db
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
		.where(owns(plantType, hid))
		.groupBy(plantType.id)
		.orderBy(asc(plantType.commonName))
		.all();
}

export async function getPlantings(hid: HouseholdId, plantTypeId: number) {
	return await db
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
		.where(and(owns(planting, hid), eq(planting.plantTypeId, plantTypeId)))
		.orderBy(asc(planting.label))
		.all();
}
