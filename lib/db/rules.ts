/**
 * Deleting care rules, and what has to follow.
 *
 * The schema says a deleted rule detaches its log (ON DELETE SET NULL), but
 * that only happens where foreign keys are enforced, and figgy does not count
 * on a hosted connection doing so. The detaching is done here instead, and
 * every delete of a rule goes through this. A log entry outlives
 * its rule as an ad-hoc record of what was done.
 */
import { inArray, type SQL } from 'drizzle-orm';
import type { Db, Tx } from './client';
import { careLog, careRule } from './schema';

export async function deleteRules(db: Db | Tx, where: SQL | undefined) {
	await db
		.update(careLog)
		.set({ careRuleId: null })
		.where(
			inArray(
				careLog.careRuleId,
				db.select({ id: careRule.id }).from(careRule).where(where),
			),
		)
		.run();
	await db.delete(careRule).where(where).run();
}
