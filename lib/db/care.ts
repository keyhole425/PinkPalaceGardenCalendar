/**
 * Writing a job down as done.
 *
 * Ticking a job and sowing a plant both answer an occurrence the engine
 * found, and both write it the same way: the action, the season and the key
 * come from the occurrence, never from a form.
 */
import type { IsoDate } from '@/lib/dates';
import { db } from './client';
import type { Task } from './queries/garden';
import { careLog } from './schema';
import type { HouseholdId } from './tenancy';

/** The new log's id, or null when that occurrence was already done. */
export async function logCompletion(
	hid: HouseholdId,
	{ occurrence, context }: Task,
	completedOn: IsoDate,
	notes?: string | null,
): Promise<number | null> {
	const written = await db
		.insert(careLog)
		.values({
			householdId: hid,
			plantingId: context.plantingId,
			// Always the representative rule. The engine treats any member of
			// a set of alternatives as satisfying the whole set.
			careRuleId: occurrence.rule.id,
			action: occurrence.rule.action,
			seasonYear: occurrence.seasonYear,
			occurrenceKey: occurrence.key,
			completedOn,
			notesMd: notes || null,
		})
		// The unique index on the occurrence means a clash is almost always a
		// double submit. Asked for in the statement rather than read out of an
		// error message, which the driver is free to word however it likes.
		.onConflictDoNothing()
		.returning({ id: careLog.id })
		.get();
	return written?.id ?? null;
}
