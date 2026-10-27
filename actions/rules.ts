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
import { requireHousehold } from '@/lib/auth/context';
import { db, type Tx } from '@/lib/db/client';
import { deleteRules } from '@/lib/db/rules';
import {
	CADENCES,
	CARE_ACTIONS,
	careRule,
	ENVIRONMENT_KINDS,
	plantType,
} from '@/lib/db/schema';
import { type HouseholdId, ownedRow, owns } from '@/lib/db/tenancy';
import { ruleChangedLater } from '@/lib/library/suggestions';
import { maskFromMonths } from '@/lib/schedule/months';

export type ActionResult = { ok: true } | { ok: false; error: string };

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

/** The plant's slug, and proof that it is this household's to edit. */
async function slugFor(
	hid: HouseholdId,
	plantTypeId: number,
): Promise<string | undefined> {
	const row = await db
		.select({ slug: plantType.slug })
		.from(plantType)
		.where(ownedRow(plantType, plantTypeId, hid))
		.get();
	return row?.slug;
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
async function adoptRemaining(
	tx: Tx,
	hid: HouseholdId,
	plantTypeId: number,
	action: string,
	when: string,
) {
	await tx
		.update(careRule)
		.set({ userModifiedAt: when })
		.where(
			and(
				owns(careRule, hid),
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
	const { householdId } = await requireHousehold();
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

	const slug = await slugFor(householdId, plantTypeId);
	if (!slug) return { ok: false, error: 'No such plant.' };

	const common = {
		householdId,
		plantTypeId,
		action,
		cadence,
		environmentKind,
		note: note || null,
		source: 'user' as const,
		userModifiedAt: now,
		active: true,
	};

	const altGroup = alternatives ? `${slug}:${action}:${Date.now()}` : null;
	// One row per month for a set of alternatives, one row for the whole window
	// otherwise. Either way a single insert.
	const rows = alternatives
		? months.map((month) => ({
				...common,
				monthMask: maskFromMonths([month]),
				altGroup,
			}))
		: [{ ...common, monthMask: maskFromMonths(months), altGroup }];

	// Replacing a group is delete-then-insert. Together or not at all, or a
	// failure in between would lose the rule outright.
	await db.transaction(async (tx) => {
		if (replacing.length > 0) {
			await deleteRules(
				tx,
				and(
					owns(careRule, householdId),
					eq(careRule.plantTypeId, plantTypeId),
					inArray(careRule.id, replacing),
				),
			);
		}
		await tx.insert(careRule).values(rows).run();
		await adoptRemaining(tx, householdId, plantTypeId, action, now);
	});
	await ruleChangedLater(householdId, plantTypeId, action);
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
	const { householdId } = await requireHousehold();
	const parsed = deleteSchema.safeParse({
		plantTypeId: form.get('plantTypeId'),
		replacing: readIds(form, 'replacing'),
		action: form.get('action'),
	});
	if (!parsed.success) return { ok: false, error: 'Nothing to remove.' };

	const { plantTypeId, replacing, action } = parsed.data;
	const slug = await slugFor(householdId, plantTypeId);
	if (!slug) return { ok: false, error: 'No such plant.' };

	const now = new Date().toISOString();

	await db.transaction(async (tx) => {
		await deleteRules(
			tx,
			and(
				owns(careRule, householdId),
				eq(careRule.plantTypeId, plantTypeId),
				inArray(careRule.id, replacing),
			),
		);

		// The tombstone. Without it the next re-seed would put this rule back.
		await tx
			.insert(careRule)
			.values({
				householdId,
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

		await adoptRemaining(tx, householdId, plantTypeId, action, now);
	});
	await ruleChangedLater(householdId, plantTypeId, action);
	refresh(slug);
	return { ok: true };
}
