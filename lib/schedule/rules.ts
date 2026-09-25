/**
 * Working out what a particular plant, in a particular place, actually needs.
 *
 * Three things happen here, in order:
 *
 *  1. An override wins. Rules written against one planting replace the plant
 *     type's rules for that action entirely - if you have said how *this*
 *     cherry should be pruned, the template has nothing more to say about
 *     pruning it.
 *  2. The most specific environment wins. A rule written for the hothouse beats
 *     a general one when the plant is in the hothouse.
 *  3. Otherwise the environment shifts the window. The hothouse runs about a
 *     month ahead of the open garden, so a general rule moves with it.
 */
import { shiftMask } from './months';
import type { EffectiveRule, EnvironmentInput, RuleInput } from './types';

export function resolveRules(
	rules: RuleInput[],
	environment: EnvironmentInput,
	plantingId: number,
): EffectiveRule[] {
	const active = rules.filter(
		(r) => r.plantingId === null || r.plantingId === plantingId,
	);

	const byAction = new Map<string, RuleInput[]>();
	for (const rule of active) {
		const list = byAction.get(rule.action);
		if (list) list.push(rule);
		else byAction.set(rule.action, [rule]);
	}

	const resolved: EffectiveRule[] = [];
	for (const [, candidates] of byAction) {
		const overrides = candidates.filter((r) => r.plantingId !== null);
		const pool = overrides.length > 0 ? overrides : candidates;

		// A rule naming this environment beats one that names none. A rule
		// naming a different environment does not apply here at all.
		const specific = pool.filter((r) => r.environmentKind === environment.kind);
		const general = pool.filter((r) => r.environmentKind === null);
		const chosen = specific.length > 0 ? specific : general;

		resolved.push(...foldAlternatives(chosen, environment, specific.length > 0));
	}

	return resolved.sort((a, b) => a.action.localeCompare(b.action) || a.id - b.id);
}

/**
 * Collapses "August OR September" into a single job with a two-month window.
 * The separate rules survive in `ruleIds` so the grid can still draw them as
 * distinct options and a completion can be logged against any of them.
 */
function foldAlternatives(
	rules: RuleInput[],
	environment: EnvironmentInput,
	environmentSpecific: boolean,
): EffectiveRule[] {
	const groups = new Map<string, RuleInput[]>();
	for (const rule of rules) {
		// An ungrouped rule stands alone; its own id keys it.
		const key = rule.altGroup ?? `rule:${rule.id}`;
		const list = groups.get(key);
		if (list) list.push(rule);
		else groups.set(key, [rule]);
	}

	const out: EffectiveRule[] = [];
	for (const members of groups.values()) {
		const first = members[0];
		const sourceMask = members.reduce((mask, r) => mask | r.monthMask, 0);

		// A rule written for this environment already says what it means; only a
		// general rule gets moved by the environment's head start.
		const shift = environmentSpecific ? 0 : environment.windowShiftMonths;
		const monthMask = shiftMask(sourceMask, shift);

		out.push({
			id: first.id,
			ruleIds: members.map((r) => r.id),
			action: first.action,
			monthMask,
			sourceMask,
			// A set of alternatives is by definition a once-a-season job.
			cadence: members.length > 1 ? 'once_in_window' : first.cadence,
			altGroup: first.altGroup,
			note: members.find((r) => r.note)?.note ?? null,
			shifted: shift !== 0 && monthMask !== sourceMask,
			isOverride: first.plantingId !== null,
		});
	}
	return out;
}
