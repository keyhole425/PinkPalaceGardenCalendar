'use server';

/**
 * Writing down what actually happened.
 *
 * Every write re-runs the schedule to find the job being answered, rather than
 * trusting what the form says it is. The action, the season and the window all
 * come from the engine; the form only says which job, when it was done, and
 * anything you want to remember about it.
 *
 * The schedule it re-runs is the signed-in household's, so a planting id from
 * another garden simply is not on it.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireHousehold } from '@/lib/auth/context';
import { isIsoDate, today, yearOf } from '@/lib/dates';
import { logCompletion } from '@/lib/db/care';
import { db } from '@/lib/db/client';
import { findOccurrence, openSeasonsFor } from '@/lib/db/queries/garden';
import { careLog } from '@/lib/db/schema';
import { ownedRow } from '@/lib/db/tenancy';
import { contributeLater } from '@/lib/library/evidence';

export type ActionResult = { ok: true } | { ok: false; error: string };

const isoDate = z.string().refine(isIsoDate, 'Give a date as YYYY-MM-DD');

const completeSchema = z.object({
	plantingId: z.coerce.number().int().positive(),
	ruleId: z.coerce.number().int().positive(),
	occurrenceKey: z.string().min(1),
	// You prune in the morning and write it down after dinner, so the date is
	// yours to set. It just defaults to today.
	completedOn: isoDate,
	notes: z.string().trim().max(2000).optional(),
});

function refresh(slug?: string) {
	revalidatePath('/now');
	revalidatePath('/grid');
	if (slug) revalidatePath(`/plants/${slug}`);
}

export async function completeTask(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const parsed = completeSchema.safeParse({
		plantingId: form.get('plantingId'),
		ruleId: form.get('ruleId'),
		occurrenceKey: form.get('occurrenceKey'),
		completedOn: form.get('completedOn') || today(),
		notes: form.get('notes') ?? undefined,
	});
	if (!parsed.success) {
		return { ok: false, error: parsed.error.issues[0]?.message ?? 'Bad input' };
	}

	const { plantingId, ruleId, occurrenceKey, completedOn, notes } = parsed.data;
	const task = await findOccurrence(householdId, plantingId, ruleId, occurrenceKey);
	if (!task) {
		return {
			ok: false,
			error: 'That job is no longer on the schedule. Reload and try again.',
		};
	}

	const written = await logCompletion(householdId, task, completedOn, notes);
	if (written === null) {
		return { ok: false, error: 'That one is already marked done.' };
	}

	await contributeLater(householdId, [plantingId]);
	refresh(task.context.plantSlug);
	return { ok: true };
}

const harvestSchema = z.object({
	plantingId: z.coerce.number().int().positive(),
	ruleId: z.coerce.number().int().positive(),
	completedOn: isoDate,
	quantityNote: z.string().trim().max(200).optional(),
	notes: z.string().trim().max(2000).optional(),
});

/**
 * A picking. Harvest is a season rather than a job, so these carry no
 * occurrence key and you can record as many as you like - three kilos this
 * weekend, two more next.
 */
export async function logHarvest(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const parsed = harvestSchema.safeParse({
		plantingId: form.get('plantingId'),
		ruleId: form.get('ruleId'),
		completedOn: form.get('completedOn') || today(),
		quantityNote: form.get('quantityNote') ?? undefined,
		notes: form.get('notes') ?? undefined,
	});
	if (!parsed.success) {
		return { ok: false, error: parsed.error.issues[0]?.message ?? 'Bad input' };
	}

	const { plantingId, ruleId, completedOn, quantityNote, notes } = parsed.data;
	const season = (await openSeasonsFor(householdId, plantingId)).find((s) =>
		s.rule.ruleIds.includes(ruleId),
	);
	if (!season) {
		return { ok: false, error: 'Nothing is in season on that plant.' };
	}

	await db
		.insert(careLog)
		.values({
			householdId,
			plantingId,
			careRuleId: season.rule.id,
			action: season.rule.action,
			seasonYear: yearOf(season.opensOn),
			occurrenceKey: null,
			completedOn,
			quantityNote: quantityNote || null,
			notesMd: notes || null,
		})
		.run();

	await contributeLater(householdId, [plantingId]);
	refresh(season.context.plantSlug);
	return { ok: true };
}

const undoSchema = z.object({
	logId: z.coerce.number().int().positive(),
	slug: z.string().optional(),
});

export async function undoCompletion(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const parsed = undoSchema.safeParse({
		logId: form.get('logId'),
		slug: form.get('slug') ?? undefined,
	});
	if (!parsed.success) {
		return { ok: false, error: 'Nothing to undo.' };
	}

	const gone = await db
		.delete(careLog)
		.where(ownedRow(careLog, parsed.data.logId, householdId))
		.returning({ plantingId: careLog.plantingId })
		.get();
	if (gone) await contributeLater(householdId, [gone.plantingId]);
	refresh(parsed.data.slug);
	return { ok: true };
}
