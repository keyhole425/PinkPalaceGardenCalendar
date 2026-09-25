/**
 * The life of a proposal: asked for, researched, reviewed, accepted or thrown
 * away. Nothing here touches the schedule - accepting does, and that is in
 * `actions/research.ts`, where a person has to press the button.
 */
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { aiCall, aiProposal, careRule, plantType } from '@/lib/db/schema';
import { monthsFromMask } from '@/lib/schedule/months';
import { MODEL } from './client';
import { type Citation, type PlantProposal, plantProposalSchema } from './schema';

export type StoredProposal = {
	id: number;
	query: string;
	status: string;
	model: string;
	createdAt: string;
	reviewedAt: string | null;
	error: string | null;
	plantTypeId: number | null;
	plantSlug: string | null;
	notes: string | null;
	citations: Citation[];
	proposal: PlantProposal | null;
	costCents: number;
};

function parseProposal(raw: string | null): PlantProposal | null {
	if (!raw) return null;
	const parsed = plantProposalSchema.safeParse(JSON.parse(raw));
	return parsed.success ? parsed.data : null;
}

export function getProposal(id: number): StoredProposal | null {
	const row = db.select().from(aiProposal).where(eq(aiProposal.id, id)).get();
	if (!row) return null;

	const slug = row.plantTypeId
		? (db
				.select({ slug: plantType.slug })
				.from(plantType)
				.where(eq(plantType.id, row.plantTypeId))
				.get()?.slug ?? null)
		: null;

	const spend = db
		.select({ cost: aiCall.costCents })
		.from(aiCall)
		.where(eq(aiCall.proposalId, id))
		.all()
		.reduce((total, c) => total + c.cost, 0);

	return {
		id: row.id,
		query: row.query,
		status: row.status,
		model: row.model,
		createdAt: row.createdAt,
		reviewedAt: row.reviewedAt,
		error: row.error,
		plantTypeId: row.plantTypeId,
		plantSlug: slug,
		notes: row.notes,
		citations: row.citations ? JSON.parse(row.citations) : [],
		proposal: parseProposal(row.payload),
		costCents: spend,
	};
}

export function listProposals(limit = 25) {
	return db
		.select({
			id: aiProposal.id,
			query: aiProposal.query,
			status: aiProposal.status,
			createdAt: aiProposal.createdAt,
		})
		.from(aiProposal)
		.orderBy(desc(aiProposal.id))
		.limit(limit)
		.all();
}

export function startProposal(query: string, plantTypeId?: number): number {
	return db
		.insert(aiProposal)
		.values({
			query,
			plantTypeId: plantTypeId ?? null,
			model: MODEL,
			status: 'running',
		})
		.returning({ id: aiProposal.id })
		.get().id;
}

export function finishProposal(
	id: number,
	result: {
		proposal: PlantProposal;
		notes: string;
		citations: Citation[];
	},
) {
	db.update(aiProposal)
		.set({
			status: 'ready',
			payload: JSON.stringify(result.proposal),
			notes: result.notes,
			citations: JSON.stringify(result.citations),
		})
		.where(eq(aiProposal.id, id))
		.run();
}

export function failProposal(id: number, error: string) {
	db.update(aiProposal)
		.set({ status: 'failed', error })
		.where(eq(aiProposal.id, id))
		.run();
}

/** What figgy already knows, phrased for a prompt. */
export function describeExisting(plantTypeId: number): string[] {
	return db
		.select({
			action: careRule.action,
			monthMask: careRule.monthMask,
			active: careRule.active,
		})
		.from(careRule)
		.where(eq(careRule.plantTypeId, plantTypeId))
		.all()
		.filter((r) => r.active)
		.map((r) => `${r.action}: months ${monthsFromMask(r.monthMask).join(', ')}`);
}

/** Total spend, for the settings screen. */
export function totalSpendCents(): number {
	return db
		.select({ cost: aiCall.costCents })
		.from(aiCall)
		.all()
		.reduce((total, c) => total + c.cost, 0);
}
