'use server';

/**
 * Asking Claude about a plant, and deciding what to do with the answer.
 *
 * The rule that makes this safe to use: researching writes a proposal and
 * nothing else. The schedule changes only in `acceptProposal`, only for the
 * windows a person ticked, and only when they press the button.
 */
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
import { db } from '@/lib/db/client';
import { aiProposal, careRule, planting, plantType } from '@/lib/db/schema';
import { maskFromMonths } from '@/lib/schedule/months';

export type ActionResult = { ok: true } | { ok: false; error: string };

function slugify(name: string): string {
	return name
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
	if (!aiAvailable()) {
		return {
			ok: false,
			error:
				'figgy has no API key, so it cannot look anything up. Add ANTHROPIC_API_KEY and restart.',
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
	const id = startProposal(query, plantTypeId);

	try {
		const known = plantTypeId
			? { commonName: query, existing: describeExisting(plantTypeId) }
			: undefined;

		const notes = await research(query, known, id);
		const proposal = await structure(query, notes, id);
		finishProposal(id, {
			proposal,
			notes: notes.notes,
			citations: notes.citations,
		});
	} catch (error) {
		failProposal(id, describeError(error));
	}

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
	const parsed = acceptSchema.safeParse({
		proposalId: form.get('proposalId'),
		accept: form.getAll('accept').map((v) => Number(v)),
		plantAs: form.get('plantAs') || undefined,
		environmentId: form.get('environmentId') || undefined,
	});
	if (!parsed.success) {
		return { ok: false, error: 'Nothing to accept.' };
	}

	const stored = getProposal(parsed.data.proposalId);
	if (!stored?.proposal) {
		return { ok: false, error: 'That proposal has nothing in it.' };
	}
	if (stored.status === 'accepted') {
		return { ok: false, error: 'That one has already been accepted.' };
	}

	const chosen = parsed.data.accept
		.map((index) => stored.proposal?.rules[index])
		.filter((rule) => rule !== undefined);

	const now = new Date().toISOString();
	let plantTypeId = stored.plantTypeId;
	let slug: string;

	if (plantTypeId) {
		const existing = db
			.select({ slug: plantType.slug })
			.from(plantType)
			.where(eq(plantType.id, plantTypeId))
			.get();
		if (!existing) return { ok: false, error: 'That plant has gone.' };
		slug = existing.slug;

		// Fill in blanks only. What the gardener wrote stays as they wrote it.
		const row = db
			.select()
			.from(plantType)
			.where(eq(plantType.id, plantTypeId))
			.get();
		db.update(plantType)
			.set({
				scientificName: row?.scientificName || stored.proposal.scientificName,
				family: row?.family || stored.proposal.family,
				notesMd: row?.notesMd || stored.proposal.notesMd,
				userModifiedAt: now,
			})
			.where(eq(plantType.id, plantTypeId))
			.run();
	} else {
		slug = slugify(stored.proposal.commonName) || slugify(stored.query);
		let attempt = 1;
		while (
			db
				.select({ id: plantType.id })
				.from(plantType)
				.where(eq(plantType.slug, slug))
				.get()
		) {
			attempt++;
			slug = `${slugify(stored.proposal.commonName)}-${attempt}`;
		}

		plantTypeId = db
			.insert(plantType)
			.values({
				slug,
				commonName: stored.proposal.commonName,
				scientificName: stored.proposal.scientificName || null,
				category: stored.proposal.category,
				lifecycle: stored.proposal.lifecycle,
				family: stored.proposal.family || null,
				notesMd: stored.proposal.notesMd || null,
				daysToMaturityMin: stored.proposal.daysToMaturityMin || null,
				daysToMaturityMax: stored.proposal.daysToMaturityMax || null,
				spacingCm: stored.proposal.spacingCm || null,
				source: 'ai',
				sourceRef: `Researched by ${stored.model}, proposal ${stored.id}`,
				// Accepting it is the review.
				needsReview: false,
				userModifiedAt: now,
			})
			.returning({ id: plantType.id })
			.get().id;
	}

	for (const [index, rule] of chosen.entries()) {
		const sourceRef = [
			`${stored.model}, proposal ${stored.id}`,
			rule.sources.slice(0, 3).join(' '),
		]
			.filter(Boolean)
			.join(' - ');

		const common = {
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
				db.insert(careRule)
					.values({ ...common, monthMask: maskFromMonths([month]), altGroup })
					.run();
			}
		} else {
			db.insert(careRule)
				.values({ ...common, monthMask: maskFromMonths(rule.months) })
				.run();
		}
	}

	// A plant with nowhere to grow has no schedule, so offer to plant it too.
	if (parsed.data.plantAs && parsed.data.environmentId) {
		db.insert(planting)
			.values({
				plantTypeId,
				environmentId: parsed.data.environmentId,
				label: parsed.data.plantAs,
				status: 'active',
			})
			.run();
	}

	db.update(aiProposal)
		.set({ status: 'accepted', reviewedAt: now, plantTypeId })
		.where(eq(aiProposal.id, stored.id))
		.run();

	refresh(slug);
	redirect(`/plants/${slug}`);
}

export async function rejectProposal(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const id = Number(form.get('proposalId'));
	if (!Number.isInteger(id) || id <= 0) {
		return { ok: false, error: 'Nothing to reject.' };
	}

	db.update(aiProposal)
		.set({ status: 'rejected', reviewedAt: new Date().toISOString() })
		.where(eq(aiProposal.id, id))
		.run();

	revalidatePath(`/proposals/${id}`);
	return { ok: true };
}
