import { describe, expect, it } from 'vitest';
import { expandOccurrences, openSeasons, windowsForRule } from './expand';
import { maskFromMonths } from './months';
import { resolveRules } from './rules';
import type { EffectiveRule, EnvironmentInput, LogInput, RuleInput } from './types';

const orchard: EnvironmentInput = {
	id: 1,
	kind: 'orchard',
	name: 'The Orchard',
	frostFree: false,
	windowShiftMonths: 0,
};

const hothouse: EnvironmentInput = {
	id: 2,
	kind: 'hothouse',
	name: 'The Hothouse',
	frostFree: true,
	// A month ahead of the open garden.
	windowShiftMonths: -1,
};

function rule(over: Partial<RuleInput> & { id: number }): RuleInput {
	return {
		action: 'fertilise',
		monthMask: maskFromMonths([9]),
		cadence: 'monthly',
		altGroup: null,
		environmentKind: null,
		note: null,
		plantingId: null,
		...over,
	};
}

function effective(over: Partial<EffectiveRule> & { id: number }): EffectiveRule {
	return {
		ruleIds: [over.id],
		action: 'fertilise',
		monthMask: maskFromMonths([9]),
		sourceMask: maskFromMonths([9]),
		cadence: 'monthly',
		altGroup: null,
		note: null,
		shifted: false,
		isOverride: false,
		...over,
	};
}

describe('windows', () => {
	it('gives a monthly rule one window per month it names', () => {
		// Lemon fertilise: January, March, September, November.
		const r = effective({ id: 1, monthMask: maskFromMonths([1, 3, 9, 11]) });
		const windows = windowsForRule(r, 2026, 2026);
		expect(windows).toHaveLength(4);
		expect(windows.map((w) => w.key)).toEqual([
			'2026-01',
			'2026-03',
			'2026-09',
			'2026-11',
		]);
		expect(windows[0]).toMatchObject({
			opensOn: '2026-01-01',
			closesOn: '2026-01-31',
			seasonYear: 2026,
		});
	});

	it('closes a window on the real last day of the month', () => {
		const feb = effective({ id: 1, monthMask: maskFromMonths([2]) });
		expect(windowsForRule(feb, 2024, 2024)[0].closesOn).toBe('2024-02-29');
		expect(windowsForRule(feb, 2026, 2026)[0].closesOn).toBe('2026-02-28');
	});

	it('carries a wrapping window into the following year', () => {
		// Cherry harvest, treated as a once-a-season job for this test.
		const r = effective({
			id: 1,
			monthMask: maskFromMonths([11, 12, 1, 2]),
			cadence: 'once_in_window',
		});
		const windows = windowsForRule(r, 2026, 2026);
		expect(windows).toHaveLength(1);
		expect(windows[0]).toMatchObject({
			opensOn: '2026-11-01',
			closesOn: '2027-02-28',
			// The season belongs to the year it began in, not the year it ended.
			seasonYear: 2026,
			key: '2026-w11',
		});
	});

	it('gives a once-a-season rule one window per separate run', () => {
		const r = effective({
			id: 1,
			monthMask: maskFromMonths([2, 9]),
			cadence: 'once_in_window',
		});
		expect(windowsForRule(r, 2026, 2026).map((w) => w.key)).toEqual([
			'2026-w2',
			'2026-w9',
		]);
	});

	it('produces nothing for a continuous window', () => {
		const r = effective({ id: 1, cadence: 'continuous' });
		expect(windowsForRule(r, 2026, 2026)).toEqual([]);
	});
});

describe('resolving what a plant needs', () => {
	it('folds alternatives into one job with a combined window', () => {
		// Mandarin: prune in August, September or October - once.
		const rules = [
			rule({
				id: 1,
				action: 'prune',
				monthMask: maskFromMonths([8]),
				altGroup: 'm:prune',
				cadence: 'once_in_window',
			}),
			rule({
				id: 2,
				action: 'prune',
				monthMask: maskFromMonths([9]),
				altGroup: 'm:prune',
				cadence: 'once_in_window',
			}),
			rule({
				id: 3,
				action: 'prune',
				monthMask: maskFromMonths([10]),
				altGroup: 'm:prune',
				cadence: 'once_in_window',
			}),
		];
		const [resolved] = resolveRules(rules, orchard, 99);
		expect(resolved.ruleIds).toEqual([1, 2, 3]);
		expect(resolved.monthMask).toBe(maskFromMonths([8, 9, 10]));
		expect(resolved.cadence).toBe('once_in_window');

		const windows = windowsForRule(resolved, 2026, 2026);
		expect(windows).toHaveLength(1);
		expect(windows[0]).toMatchObject({
			opensOn: '2026-08-01',
			closesOn: '2026-10-31',
		});
	});

	it('keeps independent rules for the same action apart', () => {
		// Cumquat: a February-or-March feed, and a separate September one.
		const rules = [
			rule({
				id: 1,
				monthMask: maskFromMonths([2]),
				altGroup: 'c:fertilise',
				cadence: 'once_in_window',
			}),
			rule({
				id: 2,
				monthMask: maskFromMonths([3]),
				altGroup: 'c:fertilise',
				cadence: 'once_in_window',
			}),
			rule({ id: 3, monthMask: maskFromMonths([9]) }),
		];
		const resolved = resolveRules(rules, orchard, 99);
		expect(resolved).toHaveLength(2);
		expect(resolved.find((r) => r.altGroup)?.monthMask).toBe(
			maskFromMonths([2, 3]),
		);
		expect(resolved.find((r) => !r.altGroup)?.monthMask).toBe(maskFromMonths([9]));
	});

	it('shifts a general window into the hothouse', () => {
		const rules = [
			rule({ id: 1, action: 'sow', monthMask: maskFromMonths([9, 10, 11]) }),
		];
		const [outside] = resolveRules(rules, orchard, 99);
		const [inside] = resolveRules(rules, hothouse, 99);

		expect(outside.monthMask).toBe(maskFromMonths([9, 10, 11]));
		expect(outside.shifted).toBe(false);
		expect(inside.monthMask).toBe(maskFromMonths([8, 9, 10]));
		expect(inside.shifted).toBe(true);
		// The written window is kept, so the UI can say what moved and why.
		expect(inside.sourceMask).toBe(maskFromMonths([9, 10, 11]));
	});

	it('takes a rule written for the hothouse literally', () => {
		const rules = [
			rule({ id: 1, action: 'sow', monthMask: maskFromMonths([9, 10]) }),
			rule({
				id: 2,
				action: 'sow',
				monthMask: maskFromMonths([7, 8]),
				environmentKind: 'hothouse',
			}),
		];
		const [inside] = resolveRules(rules, hothouse, 99);
		expect(inside.id).toBe(2);
		// No shift: a rule that names the hothouse already means what it says.
		expect(inside.monthMask).toBe(maskFromMonths([7, 8]));
		expect(inside.shifted).toBe(false);

		const [outside] = resolveRules(rules, orchard, 99);
		expect(outside.id).toBe(1);
	});

	it('lets a rule for one plant replace the type default', () => {
		const rules = [
			rule({ id: 1, action: 'prune', monthMask: maskFromMonths([8]) }),
			rule({
				id: 2,
				action: 'prune',
				monthMask: maskFromMonths([2]),
				plantingId: 7,
			}),
			rule({ id: 3, action: 'fertilise', monthMask: maskFromMonths([9]) }),
		];
		const resolved = resolveRules(rules, orchard, 7);
		const prune = resolved.find((r) => r.action === 'prune');
		expect(prune?.id).toBe(2);
		expect(prune?.isOverride).toBe(true);
		// Overriding pruning says nothing about feeding.
		expect(resolved.find((r) => r.action === 'fertilise')?.id).toBe(3);
	});

	it('ignores a rule belonging to a different plant', () => {
		const rules = [
			rule({ id: 1, action: 'prune', monthMask: maskFromMonths([8]) }),
			rule({
				id: 2,
				action: 'prune',
				monthMask: maskFromMonths([2]),
				plantingId: 7,
			}),
		];
		expect(resolveRules(rules, orchard, 8).map((r) => r.id)).toEqual([1]);
	});
});

describe('what state a job is in', () => {
	const september = effective({ id: 1, monthMask: maskFromMonths([9]) });

	function stateOn(day: string, logs: LogInput[] = []) {
		const [occurrence] = expandOccurrences([september], logs, {
			today: day,
			from: '2026-09-01',
			to: '2026-09-30',
		});
		return occurrence;
	}

	it('is due inside the window', () => {
		expect(stateOn('2026-09-15').state).toBe('due');
		expect(stateOn('2026-09-01').state).toBe('due');
		expect(stateOn('2026-09-30').state).toBe('due');
	});

	it('is overdue once the window has closed', () => {
		expect(stateOn('2026-10-01').state).toBe('overdue');
	});

	it('is coming up three weeks out, and not before', () => {
		expect(stateOn('2026-08-20').state).toBe('upcoming');
		expect(stateOn('2026-08-11').state).toBe('upcoming');
		expect(stateOn('2026-08-01').state).toBe('future');
	});

	it('is done once it is logged', () => {
		const occurrence = stateOn('2026-09-20', [
			{ id: 1, careRuleId: 1, occurrenceKey: '2026-09', completedOn: '2026-09-14' },
		]);
		expect(occurrence.state).toBe('done');
		expect(occurrence.completedOn).toBe('2026-09-14');
	});

	it('does not count last year against this year', () => {
		const occurrence = stateOn('2026-09-20', [
			{ id: 1, careRuleId: 1, occurrenceKey: '2025-09', completedOn: '2025-09-14' },
		]);
		expect(occurrence.state).toBe('due');
	});

	it('counts any one of a set of alternatives', () => {
		// Pruned in August; September was the other option, so the job is done.
		const prune = effective({
			id: 1,
			ruleIds: [1, 2],
			action: 'prune',
			monthMask: maskFromMonths([8, 9]),
			cadence: 'once_in_window',
			altGroup: 'lemon:prune',
		});
		const [occurrence] = expandOccurrences(
			[prune],
			[
				{
					id: 5,
					careRuleId: 2,
					occurrenceKey: '2026-w8',
					completedOn: '2026-08-30',
				},
			],
			{ today: '2026-09-10', from: '2026-08-01', to: '2026-09-30' },
		);
		expect(occurrence.state).toBe('done');
	});
});

describe('harvest seasons', () => {
	const cherry = effective({
		id: 1,
		action: 'harvest',
		monthMask: maskFromMonths([11, 12, 1, 2]),
		cadence: 'continuous',
	});

	it('is open in the middle of the season', () => {
		const [season] = openSeasons([cherry], '2026-12-10');
		expect(season).toMatchObject({
			opensOn: '2026-11-01',
			closesOn: '2027-02-28',
		});
	});

	it('knows a January picking began the previous November', () => {
		const [season] = openSeasons([cherry], '2027-01-10');
		expect(season).toMatchObject({
			opensOn: '2026-11-01',
			closesOn: '2027-02-28',
		});
	});

	it('is closed out of season', () => {
		expect(openSeasons([cherry], '2026-07-10')).toEqual([]);
	});
});
