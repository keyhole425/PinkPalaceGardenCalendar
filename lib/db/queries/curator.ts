/**
 * The library from the curator's side: what gardens have suggested, what
 * their grows say, and where that disagrees with the library.
 *
 * For site admins only - the pages that call this check first. Nothing here
 * is a household's: evidence and suggestions carry no household, and the
 * notes in them have had names taken out.
 */
import { and, asc, desc, eq } from 'drizzle-orm';
import { flagsFor, median } from '@/lib/library/flags';
import { loadAllResolved, type ResolvedPlant } from '@/lib/library/resolve';
import type {
	NewPlantPayload,
	NotePayload,
	ResearchPayload,
	RuleChangePayload,
} from '@/lib/library/suggestions';
import { db } from '../client';
import {
	libraryEvidence,
	libraryPlant,
	libraryRegionNote,
	librarySuggestion,
	type RegionId,
	type SuggestionKind,
} from '../schema';

export type Suggestion =
	| {
			id: number;
			kind: 'rule_change';
			createdAt: string;
			payload: RuleChangePayload;
	  }
	| { id: number; kind: 'research'; createdAt: string; payload: ResearchPayload }
	| { id: number; kind: 'note'; createdAt: string; payload: NotePayload }
	| { id: number; kind: 'new_plant'; createdAt: string; payload: NewPlantPayload };

function parse(row: {
	id: number;
	kind: SuggestionKind;
	createdAt: string;
	payload: string;
}): Suggestion {
	return { ...row, payload: JSON.parse(row.payload) } as Suggestion;
}

export type MonthTally = {
	month: number;
	grows: number;
	harvested: number;
	lost: number;
	growing: number;
	medianDays: number | null;
};

export type EvidenceSummary = {
	grows: number;
	gardens: number;
	medianDays: number | null;
	bySowMonth: MonthTally[];
	notes: string[];
	flags: string[];
};

type EvidenceRow = typeof libraryEvidence.$inferSelect;

function summarise(plant: ResolvedPlant, rows: EvidenceRow[]): EvidenceSummary {
	const months = new Map<number, EvidenceRow[]>();
	for (const row of rows) {
		if (row.sowMonth === null) continue;
		months.set(row.sowMonth, [...(months.get(row.sowMonth) ?? []), row]);
	}
	const days = (list: EvidenceRow[]) =>
		median(
			list.map((r) => r.daysToFirstHarvest).filter((d): d is number => d !== null),
		);
	return {
		grows: rows.length,
		gardens: new Set(rows.map((r) => r.gardenKey)).size,
		medianDays: days(rows),
		bySowMonth: [...months.entries()]
			.sort(([a], [b]) => a - b)
			.map(([month, list]) => ({
				month,
				grows: list.length,
				harvested: list.filter((r) => r.outcome === 'harvested').length,
				lost: list.filter((r) => r.outcome === 'died' || r.outcome === 'pulled')
					.length,
				growing: list.filter((r) => r.outcome === 'growing').length,
				medianDays: days(list),
			})),
		notes: rows
			.flatMap((r) => (r.notes ? (JSON.parse(r.notes) as string[]) : []))
			.slice(0, 30),
		flags: flagsFor(
			plant.rules,
			plant.daysToMaturityMin,
			plant.daysToMaturityMax,
			rows,
		),
	};
}

export type LibraryOverview = {
	newPlants: Suggestion[];
	plants: {
		plant: ResolvedPlant;
		open: number;
		grows: number;
		flags: string[];
	}[];
};

/** The front of the curator's page: what is waiting, plant by plant. */
export async function libraryOverview(region: RegionId): Promise<LibraryOverview> {
	const library = await loadAllResolved(db, region);
	const open = await db
		.select()
		.from(librarySuggestion)
		.where(
			and(
				eq(librarySuggestion.status, 'open'),
				eq(librarySuggestion.region, region),
			),
		)
		.orderBy(asc(librarySuggestion.id))
		.all();
	const evidence = await db
		.select()
		.from(libraryEvidence)
		.where(eq(libraryEvidence.region, region))
		.all();
	return {
		newPlants: open.filter((s) => s.kind === 'new_plant').map(parse),
		plants: library.map((plant) => {
			const rows = evidence.filter((e) => e.libraryPlantId === plant.id);
			return {
				plant,
				open: open.filter((s) => s.libraryPlantId === plant.id).length,
				grows: rows.length,
				flags: flagsFor(
					plant.rules,
					plant.daysToMaturityMin,
					plant.daysToMaturityMax,
					rows,
				),
			};
		}),
	};
}

export type CuratorPlant = {
	plant: ResolvedPlant;
	/**
	 * The words as stored on this plant, not filled in from a parent: what
	 * the editor shows, so saving a kind doesn't copy its parent's text onto
	 * it and stop it following the parent's corrections.
	 */
	own: typeof libraryPlant.$inferSelect;
	library: ResolvedPlant[];
	suggestions: Suggestion[];
	evidence: EvidenceSummary;
	/** The region note as written on this plant, not inherited. */
	ownRegionNote: string | null;
};

export async function curatorPlant(
	slug: string,
	region: RegionId,
): Promise<CuratorPlant | null> {
	const library = await loadAllResolved(db, region);
	const plant = library.find((p) => p.slug === slug);
	const own = await db
		.select()
		.from(libraryPlant)
		.where(eq(libraryPlant.slug, slug))
		.get();
	if (!plant || !own) return null;
	const suggestions = (
		await db
			.select()
			.from(librarySuggestion)
			.where(
				and(
					eq(librarySuggestion.libraryPlantId, plant.id),
					eq(librarySuggestion.status, 'open'),
					eq(librarySuggestion.region, region),
				),
			)
			.orderBy(desc(librarySuggestion.id))
			.all()
	).map(parse);
	const rows = await db
		.select()
		.from(libraryEvidence)
		.where(
			and(
				eq(libraryEvidence.libraryPlantId, plant.id),
				eq(libraryEvidence.region, region),
			),
		)
		.all();
	const note = await db
		.select({ noteMd: libraryRegionNote.noteMd })
		.from(libraryRegionNote)
		.where(
			and(
				eq(libraryRegionNote.libraryPlantId, plant.id),
				eq(libraryRegionNote.region, region),
			),
		)
		.get();
	return {
		plant,
		own,
		library,
		suggestions,
		evidence: summarise(plant, rows),
		ownRegionNote: note?.noteMd ?? null,
	};
}

export type Decided = {
	id: number;
	what: string;
	outcome: 'accepted' | 'turned down' | 'read';
};

/** A sentence for a suggestion, for the "Just decided" list. */
function describe(s: Suggestion): string {
	switch (s.kind) {
		case 'rule_change':
			return s.payload.removed
				? `A garden stopped doing ${s.payload.rule.action}`
				: `A garden’s ${s.payload.rule.action} months`;
		case 'research':
			return 'A look-up by Claude';
		case 'note':
			return s.payload.text.length > 60
				? `${s.payload.text.slice(0, 60)}…`
				: s.payload.text;
		case 'new_plant':
			return s.payload.commonName;
	}
}

/**
 * What was decided in the last quarter of an hour, here. Deciding takes a
 * suggestion out of the list it was in, which would take the proof that the
 * tap landed with it; this keeps it on the page.
 */
export async function justDecided(
	libraryPlantId: number | null,
): Promise<Decided[]> {
	const since = new Date(Date.now() - 15 * 60_000).toISOString();
	const rows = await db
		.select()
		.from(librarySuggestion)
		.where(
			libraryPlantId === null
				? eq(librarySuggestion.kind, 'new_plant')
				: eq(librarySuggestion.libraryPlantId, libraryPlantId),
		)
		.orderBy(desc(librarySuggestion.reviewedAt))
		.all();
	return rows
		.filter((r) => r.status !== 'open' && r.reviewedAt && r.reviewedAt >= since)
		.map((r) => {
			const s = parse(r);
			return {
				id: r.id,
				what: describe(s),
				outcome:
					r.status === 'rejected'
						? 'turned down'
						: s.kind === 'note'
							? 'read'
							: 'accepted',
			};
		});
}

/** One open suggestion, for an action to act on. */
export async function openSuggestion(id: number) {
	const row = await db
		.select()
		.from(librarySuggestion)
		.where(and(eq(librarySuggestion.id, id), eq(librarySuggestion.status, 'open')))
		.get();
	return row ? { ...parse(row), row } : null;
}

/** How many suggestions are waiting, for the link on Settings. */
export async function openCount(): Promise<number> {
	return (
		await db
			.select({ id: librarySuggestion.id })
			.from(librarySuggestion)
			.where(eq(librarySuggestion.status, 'open'))
			.all()
	).length;
}

/** Every library plant as something a new plant could join, for the "Add it as" choice. */
export async function libraryChoices(region: RegionId) {
	return (await loadAllResolved(db, region)).map((p) => ({
		id: p.id,
		name: p.parent
			? `${p.commonName} (a kind of ${p.parent.commonName.toLowerCase()})`
			: p.commonName,
		canHaveKinds: p.parent === null,
	}));
}
