'use server';

/**
 * Editing what a plant needs.
 *
 * The editor works on a whole rule *group* - a job and its alternatives - and
 * saving replaces the group outright. That keeps "prune in August or
 * September" as one thing to edit rather than two rows to keep in step.
 *
 * Deleting leaves a tombstone: a disabled, month-less rule owned by you. It is
 * how "this tree needs no pruning" survives a re-seed, which would otherwise
 * helpfully put the seed's pruning rule back.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { CADENCES, CARE_ACTIONS, careRule, plantType } from '@/lib/db/schema';
import { maskFromMonths } from '@/lib/schedule/months';

export type ActionResult = { ok: true } | { ok: false; error: string };

const ENVIRONMENT_KINDS = ['orchard', 'bed', 'hothouse', 'pot'] as const;

const saveSchema = z
	.object({
		plantTypeId: z.coerce.number().int().positive(),
		/** The rules being replaced. Empty when adding something new. */
		replacing: z.array(z.coerce.number().int().positive()).default([]),
		action: z.enum(CARE_ACTIONS),
		months: z.array(z.coerce.number().int().min(1).max(12)).min(1),
		cadence: z.enum(CADENCES),
		/**
		 * When true each chosen month becomes its own alternative and doing any
		 * one of them is enough - the spreadsheet's "OR" cells.
		 */
		alternatives: z.boolean().default(false),
		environmentKind: z.enum(ENVIRONMENT_KINDS).nullable().default(null),
		note: z.string().trim().max(500).optional(),
	})
	.refine((r) => !r.alternatives || r.months.length >= 2, {
		message: 'Alternatives need at least two months to choose between',
	});

function readMonths(form: FormData): number[] {
	return form
		.getAll('months')
		.map((m) => Number(m))
		.filter((m) => Number.isFinite(m));
}

function readIds(form: FormData, field: string): number[] {
	const raw = form.get(field)?.toString() ?? '';
	return raw
		.split(',')
		.map((v) => Number(v.trim()))
		.filter((v) => Number.isInteger(v) && v > 0);
}

function refresh(slug?: string) {
	revalidatePath('/now');
	revalidatePath('/grid');
	revalidatePath('/plants');
	if (slug) {
		revalidatePath(`/plants/${slug}`);
		revalidatePath(`/plants/${slug}/edit`);
	}
}

function slugFor(plantTypeId: number): string | undefined {
	return db
		.select({ slug: plantType.slug })
		.from(plantType)
		.where(eq(plantType.id, plantTypeId))
		.get()?.slug;
}

/**
 * Taking charge of an action takes charge of all of it.
 *
 * Editing or removing one rule tells the seed that pruning (or feeding, or
 * whatever) is yours now, and it stops writing its own version back. Any other
 * rule it left for that action has to be adopted at the same moment, or the
 * next re-seed would quietly delete it as its own property. The rule keeps its
 * source and its reference back to the spreadsheet; it is simply no longer the
 * seed's to remove.
 */
function adoptRemaining(plantTypeId: number, action: string, when: string) {
	db.update(careRule)
		.set({ userModifiedAt: when })
		.where(
			and(
				eq(careRule.plantTypeId, plantTypeId),
				eq(careRule.action, action as (typeof CARE_ACTIONS)[number]),
				isNull(careRule.userModifiedAt),
			),
		)
		.run();
}

export async function saveRule(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const parsed = saveSchema.safeParse({
		plantTypeId: form.get('plantTypeId'),
		replacing: readIds(form, 'replacing'),
		action: form.get('action'),
		months: readMonths(form),
		cadence: form.get('cadence'),
		alternatives: form.get('alternatives') === 'on',
		environmentKind: form.get('environmentKind') || null,
		note: form.get('note') ?? undefined,
	});
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? 'Check the months and action',
		};
	}

	const {
		plantTypeId,
		replacing,
		action,
		months,
		alternatives,
		environmentKind,
		note,
	} = parsed.data;
	// A set of alternatives is by definition a once-a-season job.
	const cadence = alternatives ? 'once_in_window' : parsed.data.cadence;
	const now = new Date().toISOString();

	const slug = slugFor(plantTypeId);
	if (!slug) return { ok: false, error: 'No such plant.' };

	if (replacing.length > 0) {
		db.delete(careRule)
			.where(
				and(eq(careRule.plantTypeId, plantTypeId), inArray(careRule.id, replacing)),
			)
			.run();
	}

	const common = {
		plantTypeId,
		action,
		cadence,
		environmentKind,
		note: note || null,
		source: 'user' as const,
		userModifiedAt: now,
		active: true,
	};

	if (alternatives) {
		const altGroup = `${slug}:${action}:${Date.now()}`;
		for (const month of months) {
			db.insert(careRule)
				.values({ ...common, monthMask: maskFromMonths([month]), altGroup })
				.run();
		}
	} else {
		db.insert(careRule)
			.values({ ...common, monthMask: maskFromMonths(months), altGroup: null })
			.run();
	}

	adoptRemaining(plantTypeId, action, now);
	refresh(slug);
	return { ok: true };
}

const deleteSchema = z.object({
	plantTypeId: z.coerce.number().int().positive(),
	replacing: z.array(z.coerce.number().int().positive()).min(1),
	action: z.enum(CARE_ACTIONS),
});

export async function deleteRule(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const parsed = deleteSchema.safeParse({
		plantTypeId: form.get('plantTypeId'),
		replacing: readIds(form, 'replacing'),
		action: form.get('action'),
	});
	if (!parsed.success) return { ok: false, error: 'Nothing to remove.' };

	const { plantTypeId, replacing, action } = parsed.data;
	const slug = slugFor(plantTypeId);
	if (!slug) return { ok: false, error: 'No such plant.' };

	db.delete(careRule)
		.where(
			and(eq(careRule.plantTypeId, plantTypeId), inArray(careRule.id, replacing)),
		)
		.run();

	const now = new Date().toISOString();

	// The tombstone. Without it the next re-seed would put this rule back.
	db.insert(careRule)
		.values({
			plantTypeId,
			action,
			monthMask: 0,
			cadence: 'once_in_window',
			active: false,
			source: 'user',
			userModifiedAt: now,
			note: 'Removed by hand.',
		})
		.run();

	adoptRemaining(plantTypeId, action, now);
	refresh(slug);
	return { ok: true };
}
