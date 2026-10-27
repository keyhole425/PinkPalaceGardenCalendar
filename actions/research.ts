'use server';

/**
 * Asking Claude about a plant, and deciding what to do with the answer.
 *
 * The rule that makes this safe to use: researching writes a proposal and
 * nothing else. The schedule changes only in `acceptProposal`, only for the
 * windows a person ticked, and only when they press the button.
 */
import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { z } from 'zod';
import { aiAvailable, describeError } from '@/lib/ai/client';
import {
	describeExisting,
	failProposal,
	finishProposal,
	getProposal,
	startProposal,
} from '@/lib/ai/proposals';
import { research, structure } from '@/lib/ai/research';
import { requireHousehold } from '@/lib/auth/context';
import { db } from '@/lib/db/client';
import {
	aiProposal,
	careRule,
	environment,
	planting,
	plantType,
} from '@/lib/db/schema';
import { isOwned, ownedRow, owns } from '@/lib/db/tenancy';
import { afterResponse, contributePlant } from '@/lib/library/evidence';
import { researched } from '@/lib/library/suggestions';
import { maskFromMonths } from '@/lib/schedule/months';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Under the 300 seconds the pages that start research allow. */
const RESEARCH_BUDGET_MS = 270_000;

function slugify(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
}

function refresh(slug?: string) {
	revalidatePath('/now');
	revalidatePath('/grid');
	revalidatePath('/plants');
	revalidatePath('/settings');
	if (slug) {
		revalidatePath(`/plants/${slug}`);
		revalidatePath(`/plants/${slug}/edit`);
	}
}

const askSchema = z.object({
	query: z.string().trim().min(2, 'What should figgy look up?').max(120),
	plantTypeId: z.coerce.number().int().positive().optional(),
});

export async function askAboutPlant(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	if (!(await aiAvailable(householdId))) {
		return {
			ok: false,
			error:
				'This household has no Anthropic key yet, so figgy cannot look anything up. An admin can add one in Settings.',
		};
	}

	const parsed = askSchema.safeParse({
		query: form.get('query'),
		plantTypeId: form.get('plantTypeId') || undefined,
	});
	if (!parsed.success) {
		return { ok: false, error: parsed.error.issues[0]?.message ?? 'Bad input' };
	}

	const { query, plantTypeId } = parsed.data;
	if (plantTypeId && !(await isOwned(plantType, plantTypeId, householdId))) {
		return { ok: false, error: 'No such plant.' };
	}
	const id = await startProposal(householdId, query, plantTypeId);

	// Two long calls to Claude, with web searches between - often longer than
	// anyone should watch a button spin. The proposal page opens straight away
	// and fills in when this finishes, after the response has gone.
	after(async () => {
		// A little under the page's maxDuration, so a run that is going to be
		// cut off fails cleanly here rather than being killed mid-write.
		const signal = AbortSignal.timeout(RESEARCH_BUDGET_MS);
		try {
			const known = plantTypeId
				? {
						commonName: query,
						existing: await describeExisting(householdId, plantTypeId),
					}
				: undefined;

			const notes = await research(householdId, query, known, id, signal);
			const proposal = await structure(householdId, query, notes, id, signal);
			await finishProposal(householdId, id, {
				proposal,
				notes: notes.notes,
				citations: notes.citations,
			});
		} catch (error) {
			await failProposal(
				householdId,
				id,
				signal.aborted
					? 'That took too long, so figgy stopped it.'
					: describeError(error),
			);
		}
	});

	revalidatePath('/settings');
	redirect(`/proposals/${id}`);
}

const acceptSchema = z.object({
	proposalId: z.coerce.number().int().positive(),
	/** Indexes into the proposal's rule list; only these are taken. */
	accept: z.array(z.coerce.number().int().min(0)).default([]),
	plantAs: z.string().trim().max(80).optional(),
	environmentId: z.coerce.number().int().positive().optional(),
});

export async function acceptProposal(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const parsed = acceptSchema.safeParse({
		proposalId: form.get('proposalId'),
		accept: form.getAll('accept').map((v) => Number(v)),
		plantAs: form.get('plantAs') || undefined,
		environmentId: form.get('environmentId') || undefined,
	});
	if (!parsed.success) {
		return { ok: false, error: 'Nothing to accept.' };
	}

	const stored = await getProposal(householdId, parsed.data.proposalId);
	if (!stored?.proposal) {
		return { ok: false, error: 'That proposal has nothing in it.' };
	}
	if (stored.status === 'accepted') {
		return { ok: false, error: 'That one has already been accepted.' };
	}
	const { environmentId } = parsed.data;
	if (environmentId && !(await isOwned(environment, environmentId, householdId))) {
		return { ok: false, error: 'No such place.' };
	}

	const chosen = parsed.data.accept
		.map((index) => stored.proposal?.rules[index])
		.filter((rule) => rule !== undefined);

	// Captured so the narrowing above survives into the transaction's closure.
	const proposal = stored.proposal;
	const now = new Date().toISOString();

	// All of it or none of it: a plant with half its windows is worse than no
	// plant. The proposal is claimed first, so pressing accept twice cannot
	// write the rules twice.
	const outcome = await db.transaction(async (tx) => {
		// Read before anything is written, so this can still bail out cleanly.
		const existing = stored.plantTypeId
			? await tx
					.select()
					.from(plantType)
					.where(ownedRow(plantType, stored.plantTypeId, householdId))
					.get()
			: undefined;
		if (stored.plantTypeId && !existing) {
			return { ok: false as const, error: 'That plant has gone.' };
		}

		const claimed = await tx
			.update(aiProposal)
			.set({ status: 'accepted', reviewedAt: now })
			.where(
				and(
					ownedRow(aiProposal, stored.id, householdId),
					ne(aiProposal.status, 'accepted'),
				),
			)
			.returning({ id: aiProposal.id })
			.get();
		if (!claimed) {
			return { ok: false as const, error: 'That one has already been accepted.' };
		}

		let plantTypeId = stored.plantTypeId;
		let slug: string;

		if (plantTypeId && existing) {
			slug = existing.slug;
			const row = existing;

			// Fill in blanks only. What the gardener wrote stays as they wrote it.
			await tx
				.update(plantType)
				.set({
					scientificName: row?.scientificName || proposal.scientificName,
					family: row?.family || proposal.family,
					notesMd: row?.notesMd || proposal.notesMd,
					userModifiedAt: now,
				})
				.where(ownedRow(plantType, plantTypeId, householdId))
				.run();
		} else {
			slug = slugify(proposal.commonName) || slugify(stored.query);
			let attempt = 1;
			while (
				await tx
					.select({ id: plantType.id })
					.from(plantType)
					.where(and(owns(plantType, householdId), eq(plantType.slug, slug)))
					.get()
			) {
				attempt++;
				slug = `${slugify(proposal.commonName)}-${attempt}`;
			}

			plantTypeId = (
				await tx
					.insert(plantType)
					.values({
						householdId,
						slug,
						commonName: proposal.commonName,
						scientificName: proposal.scientificName || null,
						category: proposal.category,
						lifecycle: proposal.lifecycle,
						family: proposal.family || null,
						notesMd: proposal.notesMd || null,
						daysToMaturityMin: proposal.daysToMaturityMin || null,
						daysToMaturityMax: proposal.daysToMaturityMax || null,
						spacingCm: proposal.spacingCm || null,
						source: 'ai',
						sourceRef: `Researched by ${stored.model}, proposal ${stored.id}`,
						// Accepting it is the review.
						needsReview: false,
						userModifiedAt: now,
					})
					.returning({ id: plantType.id })
					.get()
			).id;
		}

		for (const [index, rule] of chosen.entries()) {
			const sourceRef = [
				`${stored.model}, proposal ${stored.id}`,
				rule.sources.slice(0, 3).join(' '),
			]
				.filter(Boolean)
				.join(' - ');

			const common = {
				householdId,
				plantTypeId,
				action: rule.action,
				cadence: rule.alternatives ? ('once_in_window' as const) : rule.cadence,
				note: rule.note || null,
				source: 'ai' as const,
				sourceRef,
				userModifiedAt: now,
				active: true,
			};

			if (rule.alternatives && rule.months.length > 1) {
				const altGroup = `${slug}:${rule.action}:p${stored.id}-${index}`;
				for (const month of rule.months) {
					await tx
						.insert(careRule)
						.values({ ...common, monthMask: maskFromMonths([month]), altGroup })
						.run();
				}
			} else {
				await tx
					.insert(careRule)
					.values({ ...common, monthMask: maskFromMonths(rule.months) })
					.run();
			}
		}

		// A plant with nowhere to grow has no schedule, so offer to plant it too.
		if (parsed.data.plantAs && environmentId) {
			await tx
				.insert(planting)
				.values({
					householdId,
					plantTypeId,
					environmentId,
					label: parsed.data.plantAs,
					status: 'active',
				})
				.run();
		}

		await tx
			.update(aiProposal)
			.set({ plantTypeId })
			.where(ownedRow(aiProposal, stored.id, householdId))
			.run();

		return { ok: true as const, slug, plantTypeId };
	});
	if (!outcome.ok) return outcome;

	// What the library might learn from this: Claude's months for one of its
	// plants, or a plant it doesn't have; and any planting made just now.
	const learnedFor = outcome.plantTypeId;
	await afterResponse(async () => {
		await researched(
			householdId,
			learnedFor,
			proposal,
			parsed.data.accept,
			stored.citations,
		);
		await contributePlant(householdId, learnedFor);
	});
	refresh(outcome.slug);
	redirect(`/plants/${outcome.slug}`);
}

export async function rejectProposal(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const id = Number(form.get('proposalId'));
	if (!Number.isInteger(id) || id <= 0) {
		return { ok: false, error: 'Nothing to reject.' };
	}

	await db
		.update(aiProposal)
		.set({ status: 'rejected', reviewedAt: new Date().toISOString() })
		.where(ownedRow(aiProposal, id, householdId))
		.run();

	revalidatePath(`/proposals/${id}`);
	return { ok: true };
}
