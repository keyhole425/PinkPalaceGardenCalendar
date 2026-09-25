'use server';

/**
 * Writing down what actually happened.
 *
 * Every write re-runs the schedule to find the job being answered, rather than
 * trusting what the form says it is. The action, the season and the window all
 * come from the engine; the form only says which job, when it was done, and
 * anything you want to remember about it.
 */
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isIsoDate, today, yearOf } from '@/lib/dates';
import { db } from '@/lib/db/client';
import { findOccurrence, openSeasonsFor } from '@/lib/db/queries/garden';
import { careLog, planting } from '@/lib/db/schema';

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
	const task = findOccurrence(plantingId, ruleId, occurrenceKey);
	if (!task) {
		return {
			ok: false,
			error: 'That job is no longer on the schedule. Reload and try again.',
		};
	}

	try {
		db.insert(careLog)
			.values({
				plantingId,
				// Always the representative rule. The engine treats any member of
				// a set of alternatives as satisfying the whole set.
				careRuleId: task.occurrence.rule.id,
				action: task.occurrence.rule.action,
				seasonYear: task.occurrence.seasonYear,
				occurrenceKey,
				completedOn,
				notesMd: notes || null,
			})
			.run();
	} catch (error) {
		// The unique index means this is almost always a double submit.
		if (String(error).includes('UNIQUE')) {
			return { ok: false, error: 'That one is already marked done.' };
		}
		throw error;
	}

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
	const season = openSeasonsFor(plantingId).find((s) =>
		s.rule.ruleIds.includes(ruleId),
	);
	if (!season) {
		return { ok: false, error: 'Nothing is in season on that plant.' };
	}

	db.insert(careLog)
		.values({
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
	const parsed = undoSchema.safeParse({
		logId: form.get('logId'),
		slug: form.get('slug') ?? undefined,
	});
	if (!parsed.success) {
		return { ok: false, error: 'Nothing to undo.' };
	}

	db.delete(careLog).where(eq(careLog.id, parsed.data.logId)).run();
	refresh(parsed.data.slug);
	return { ok: true };
}

const noteSchema = z.object({
	plantingId: z.coerce.number().int().positive(),
	notes: z.string().trim().min(1).max(2000),
});

/** A note against a plant with no job attached: "looking sorry for itself". */
export async function addPlantingNote(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const parsed = noteSchema.safeParse({
		plantingId: form.get('plantingId'),
		notes: form.get('notes'),
	});
	if (!parsed.success) {
		return { ok: false, error: 'Write something first.' };
	}

	const row = db
		.select({ id: planting.id })
		.from(planting)
		.where(and(eq(planting.id, parsed.data.plantingId)))
		.get();
	if (!row) return { ok: false, error: 'No such plant.' };

	const when = today();
	db.insert(careLog)
		.values({
			plantingId: parsed.data.plantingId,
			careRuleId: null,
			action: 'note',
			seasonYear: yearOf(when),
			occurrenceKey: null,
			completedOn: when,
			notesMd: parsed.data.notes,
		})
		.run();

	refresh(form.get('slug')?.toString());
	return { ok: true };
}
