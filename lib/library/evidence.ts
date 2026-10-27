/**
 * What the library learns from what grows.
 *
 * Nothing new is typed in for this. Every grow of a library plant - a
 * planting whose plant is a copy of the library's - already says when it
 * went in, when it was first picked, how often, and whether it made it. This
 * turns that into one anonymous row per grow in `library_evidence`, which
 * only a site admin reads, to decide what the library should say.
 *
 * What makes it anonymous:
 *  - No household, planting, person or label is stored. Rows are keyed by
 *    `opaqueKey` hashes, which name a grow and a garden without saying which.
 *  - No exact dates: the month it went in, and durations in days.
 *  - Notes are excerpts with the garden's own names taken out - its name,
 *    its people, its places, what it calls its plants - and they are shown to
 *    the curator only. What a household reads is the curated article.
 *    Taking names out of free text is never perfect, which is why the notes
 *    stop at the curator.
 *
 * A household that stops sharing has every row it gave deleted.
 */
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { after } from 'next/server';
import { opaqueKey, opaqueKeys } from '@/lib/crypto/secretbox';
import { daysBetween, today } from '@/lib/dates';
import { db } from '@/lib/db/client';
import {
	careLog,
	environment,
	type GrowOutcome,
	household,
	libraryEvidence,
	librarySuggestion,
	membership,
	planting,
	plantType,
	user,
} from '@/lib/db/schema';
import { type HouseholdId, owns } from '@/lib/db/tenancy';

/** The anonymous name of a garden, a grow, and a plant of a garden's own. */
export const gardenKey = (hid: HouseholdId) => opaqueKey(`garden:${hid}`);
export const growKey = (plantingId: number) => opaqueKey(`grow:${plantingId}`);
export const subjectKey = (plantTypeId: number) =>
	opaqueKey(`plant:${plantTypeId}`);

const MAX_NOTES = 6;
const MAX_NOTE_LENGTH = 280;

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Takes out what would say whose garden this is: the names given, and
 * anything shaped like an email address, a web address or a phone number.
 */
export function redact(text: string, names: string[]): string {
	let out = text
		.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[…]')
		.replace(/https?:\/\/\S+/g, '[…]')
		.replace(/(?:\+?\d[\s-]?){8,}/g, '[…]');
	// Longest first, so "Nan's lemon" goes before "Nan" can leave "'s lemon".
	for (const name of [...new Set(names)]
		.map((n) => n.trim())
		.filter((n) => n.length >= 2)
		.sort((a, b) => b.length - a.length)) {
		out = out.replace(
			new RegExp(`(?<![\\w])${escapeRegExp(name)}(?![\\w])`, 'gi'),
			'[…]',
		);
	}
	// Tidy spaces within lines, but keep the lines: a look-up's notes are
	// Markdown, and its headings and bullets are lines.
	return out
		.split('\n')
		.map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** Everything this household calls itself and its things, for redact(). */
export async function namesOf(hid: HouseholdId): Promise<string[]> {
	const home = await db
		.select({ name: household.name })
		.from(household)
		.where(eq(household.id, hid))
		.get();
	const people = await db
		.select({ name: user.name, email: user.email })
		.from(membership)
		.innerJoin(user, eq(membership.userId, user.id))
		.where(eq(membership.householdId, hid))
		.all();
	const places = await db
		.select({ name: environment.name })
		.from(environment)
		.where(owns(environment, hid))
		.all();
	const labels = await db
		.select({ label: planting.label, plant: plantType.commonName })
		.from(planting)
		.innerJoin(plantType, eq(planting.plantTypeId, plantType.id))
		.where(owns(planting, hid))
		.all();
	return [
		home?.name ?? '',
		...people.flatMap((p) => [p.name, ...p.name.split(/\s+/), p.email]),
		...places.map((p) => p.name),
		// "Tomato" says nothing about whose tomato; "Nan's tomato" does.
		...labels
			.filter((l) => l.label.toLowerCase() !== l.plant.toLowerCase())
			.map((l) => l.label),
	];
}

export type DerivedGrow = {
	sowMonth: number | null;
	plantMonth: number | null;
	seasonYear: number | null;
	daysToFirstHarvest: number | null;
	harvestSpanDays: number | null;
	picks: number;
	outcome: GrowOutcome;
	notes: string[];
};

/**
 * One grow, worked out from its planting and its log. Pure, for testing:
 * the database half is contribute(), below. Null when there is nothing
 * worth knowing yet - no date, no picking, no note.
 */
export function deriveGrow(
	p: {
		sownOn: string | null;
		plantedOn: string | null;
		transplantedOn: string | null;
		status: string;
		notesMd: string | null;
	},
	log: {
		action: string;
		completedOn: string;
		quantityNote: string | null;
		notesMd: string | null;
	}[],
	names: string[],
): DerivedGrow | null {
	const start = p.sownOn ?? p.plantedOn;
	const picks = log
		.filter((l) => l.action === 'harvest' && (!start || l.completedOn >= start))
		.map((l) => l.completedOn)
		.sort();
	const notes = [p.notesMd, ...log.flatMap((l) => [l.quantityNote, l.notesMd])]
		.filter((n): n is string => Boolean(n?.trim()))
		.map((n) => redact(n, names).slice(0, MAX_NOTE_LENGTH))
		.filter((n, i, all) => n && all.indexOf(n) === i)
		.slice(0, MAX_NOTES);

	if (!start && picks.length === 0 && notes.length === 0) return null;

	const first = picks[0];
	const last = picks.at(-1);
	const outcome: GrowOutcome =
		picks.length > 0
			? 'harvested'
			: p.status === 'dead'
				? 'died'
				: p.status === 'removed'
					? 'pulled'
					: 'growing';
	const planted = p.transplantedOn ?? p.plantedOn;
	return {
		sowMonth: p.sownOn ? Number(p.sownOn.slice(5, 7)) : null,
		plantMonth: planted ? Number(planted.slice(5, 7)) : null,
		seasonYear: start
			? Number(start.slice(0, 4))
			: first
				? Number(first.slice(0, 4))
				: null,
		daysToFirstHarvest: start && first ? daysBetween(start, first) : null,
		harvestSpanDays:
			first && last && last !== first ? daysBetween(first, last) : null,
		picks: picks.length,
		outcome,
		notes,
	};
}

async function sharing(hid: HouseholdId) {
	return await db
		.select({ share: household.shareGrowing, region: household.region })
		.from(household)
		.where(eq(household.id, hid))
		.get();
}

/**
 * Brings this household's evidence up to date: for the plantings named, or
 * every planting it has. Idempotent - each grow overwrites its own row - so
 * calling it after anything that might have changed a grow is always safe.
 */
export async function contribute(
	hid: HouseholdId,
	plantingIds?: number[],
): Promise<void> {
	const home = await sharing(hid);
	if (!home?.share) return;
	if (plantingIds && plantingIds.length === 0) return;

	const grows = await db
		.select({
			id: planting.id,
			libraryPlantId: plantType.libraryPlantId,
			environmentKind: environment.kind,
			sownOn: planting.sownOn,
			plantedOn: planting.plantedOn,
			transplantedOn: planting.transplantedOn,
			status: planting.status,
			notesMd: planting.notesMd,
		})
		.from(planting)
		.innerJoin(plantType, eq(planting.plantTypeId, plantType.id))
		.innerJoin(environment, eq(planting.environmentId, environment.id))
		.where(
			and(
				owns(planting, hid),
				plantingIds ? inArray(planting.id, plantingIds) : undefined,
			),
		)
		.all();
	if (grows.length === 0) return;

	const logs = await db
		.select({
			plantingId: careLog.plantingId,
			action: careLog.action,
			completedOn: careLog.completedOn,
			quantityNote: careLog.quantityNote,
			notesMd: careLog.notesMd,
		})
		.from(careLog)
		.where(
			and(
				owns(careLog, hid),
				inArray(
					careLog.plantingId,
					grows.map((g) => g.id),
				),
			),
		)
		.all();
	const names = await namesOf(hid);
	const garden = gardenKey(hid);
	const derivedIn = today().slice(0, 7);

	for (const grow of grows) {
		const keys = opaqueKeys(`grow:${grow.id}`);
		const derived =
			grow.libraryPlantId === null
				? null
				: deriveGrow(
						grow,
						logs.filter((l) => l.plantingId === grow.id),
						names,
					);
		// Anything written under an older key, or for a plant that is no
		// longer the library's, goes; what is true now is written fresh.
		await db
			.delete(libraryEvidence)
			.where(inArray(libraryEvidence.growKey, keys))
			.run();
		if (!derived || grow.libraryPlantId === null) continue;
		await db
			.insert(libraryEvidence)
			.values({
				growKey: keys[0],
				gardenKey: garden,
				libraryPlantId: grow.libraryPlantId,
				region: home.region,
				environmentKind: grow.environmentKind,
				seasonYear: derived.seasonYear,
				sowMonth: derived.sowMonth,
				plantMonth: derived.plantMonth,
				daysToFirstHarvest: derived.daysToFirstHarvest,
				harvestSpanDays: derived.harvestSpanDays,
				picks: derived.picks,
				outcome: derived.outcome,
				notes: derived.notes.length > 0 ? JSON.stringify(derived.notes) : null,
				derivedIn,
			})
			.run();
	}
}

/** Every grow of one household plant, for when it has just joined the library. */
export async function contributePlant(hid: HouseholdId, plantTypeId: number) {
	const ids = (
		await db
			.select({ id: planting.id })
			.from(planting)
			.where(and(owns(planting, hid), eq(planting.plantTypeId, plantTypeId)))
			.all()
	).map((p) => p.id);
	await contribute(hid, ids);
}

/** Everything a garden gave: its evidence and its open suggestions. */
export async function withdraw(hid: HouseholdId): Promise<void> {
	const keys = opaqueKeys(`garden:${hid}`);
	await db
		.delete(libraryEvidence)
		.where(inArray(libraryEvidence.gardenKey, keys))
		.run();
	await db
		.delete(librarySuggestion)
		.where(
			and(
				inArray(librarySuggestion.gardenKey, keys),
				eq(librarySuggestion.status, 'open'),
			),
		)
		.run();
}

/**
 * Runs `task` once the response has gone, so recording a picking never waits
 * on the library. Outside a request - a test, a script - there is no "after",
 * and it runs now.
 */
export async function afterResponse(task: () => Promise<void>): Promise<void> {
	try {
		after(task);
	} catch {
		await task();
	}
}

/** contribute(), after the response. What the actions call. */
export function contributeLater(hid: HouseholdId, plantingIds?: number[]) {
	return afterResponse(() => contribute(hid, plantingIds));
}

/** The ids of a household's plantings of library plants, for a full refresh. */
export async function libraryPlantings(hid: HouseholdId): Promise<number[]> {
	return (
		await db
			.select({ id: planting.id })
			.from(planting)
			.innerJoin(plantType, eq(planting.plantTypeId, plantType.id))
			.where(and(owns(planting, hid), isNotNull(plantType.libraryPlantId)))
			.all()
	).map((p) => p.id);
}
