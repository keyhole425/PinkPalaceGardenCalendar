/**
 * The life of a proposal: asked for, researched, reviewed, accepted or thrown
 * away. Nothing here touches the schedule - accepting does, and that is in
 * `actions/research.ts`, where a person has to press the button.
 */
import { and, desc, eq, sum } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { aiCall, aiProposal, careRule, plantType } from '@/lib/db/schema';
import { type HouseholdId, ownedRow, owns } from '@/lib/db/tenancy';
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

export async function getProposal(
	hid: HouseholdId,
	id: number,
): Promise<StoredProposal | null> {
	const row = await db
		.select()
		.from(aiProposal)
		.where(ownedRow(aiProposal, id, hid))
		.get();
	if (!row) return null;

	const slug = row.plantTypeId
		? ((
				await db
					.select({ slug: plantType.slug })
					.from(plantType)
					.where(ownedRow(plantType, row.plantTypeId, hid))
					.get()
			)?.slug ?? null)
		: null;

	const spend = (
		await db
			.select({ cost: aiCall.costCents })
			.from(aiCall)
			.where(and(owns(aiCall, hid), eq(aiCall.proposalId, id)))
			.all()
	).reduce((total, c) => total + c.cost, 0);

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

export async function listProposals(hid: HouseholdId, limit = 25) {
	return await db
		.select({
			id: aiProposal.id,
			query: aiProposal.query,
			status: aiProposal.status,
			createdAt: aiProposal.createdAt,
		})
		.from(aiProposal)
		.where(owns(aiProposal, hid))
		.orderBy(desc(aiProposal.id))
		.limit(limit)
		.all();
}

export async function startProposal(
	hid: HouseholdId,
	query: string,
	plantTypeId?: number,
): Promise<number> {
	return (
		await db
			.insert(aiProposal)
			.values({
				householdId: hid,
				query,
				plantTypeId: plantTypeId ?? null,
				model: MODEL,
				status: 'running',
			})
			.returning({ id: aiProposal.id })
			.get()
	).id;
}

export async function finishProposal(
	hid: HouseholdId,
	id: number,
	result: {
		proposal: PlantProposal;
		notes: string;
		citations: Citation[];
	},
) {
	await db
		.update(aiProposal)
		.set({
			status: 'ready',
			payload: JSON.stringify(result.proposal),
			notes: result.notes,
			citations: JSON.stringify(result.citations),
		})
		.where(ownedRow(aiProposal, id, hid))
		.run();
}

export async function failProposal(hid: HouseholdId, id: number, error: string) {
	await db
		.update(aiProposal)
		.set({ status: 'failed', error })
		.where(ownedRow(aiProposal, id, hid))
		.run();
}

/** What figgy already knows, phrased for a prompt. */
export async function describeExisting(
	hid: HouseholdId,
	plantTypeId: number,
): Promise<string[]> {
	return (
		await db
			.select({
				action: careRule.action,
				monthMask: careRule.monthMask,
				active: careRule.active,
			})
			.from(careRule)
			.where(and(owns(careRule, hid), eq(careRule.plantTypeId, plantTypeId)))
			.all()
	)
		.filter((r) => r.active)
		.map((r) => `${r.action}: months ${monthsFromMask(r.monthMask).join(', ')}`);
}

/** What this household has spent, for the settings screen. */
export async function totalSpendCents(hid: HouseholdId): Promise<number> {
	const row = await db
		.select({ cents: sum(aiCall.costCents) })
		.from(aiCall)
		.where(owns(aiCall, hid))
		.get();
	return Number(row?.cents ?? 0);
}
