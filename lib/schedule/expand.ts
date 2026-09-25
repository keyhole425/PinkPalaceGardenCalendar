/**
 * Turning rules into dated jobs.
 *
 * A rule says "feed in September"; an occurrence says "feed this tree between
 * the 1st and the 30th of September 2026, and here is whether that happened".
 * Nothing is stored - occurrences are derived from the rules, the log and
 * today's date every time they are asked for. A rule you edit is reflected
 * immediately, with no stale rows to clean up.
 */
import {
	endOfMonth,
	type IsoDate,
	startOfMonth,
	today as todayInGarden,
	yearOf,
} from '@/lib/dates';
import { type Month, maskRuns, monthsFromMask } from './months';
import type { EffectiveRule, LogInput, Occurrence, OccurrenceState } from './types';

/** How far ahead a window has to open before it stops being "coming up". */
export const UPCOMING_DAYS = 21;

export type Window = {
	opensOn: IsoDate;
	closesOn: IsoDate;
	seasonYear: number;
	key: string;
};

/**
 * Every window a rule produces in the given span of years.
 *
 * A `monthly` rule produces one window per month it names: lemons want feeding
 * in January, March, September and November, and those are four separate jobs.
 * A `once_in_window` rule produces one window per run of months, so "August or
 * September" is a single job with a two-month window. A `continuous` rule -
 * harvest - produces none: picking fruit is a season you are in, not a task
 * you tick off. See `openSeasons`.
 */
export function windowsForRule(
	rule: EffectiveRule,
	fromYear: number,
	toYear: number,
): Window[] {
	if (rule.cadence === 'continuous') return [];

	const windows: Window[] = [];

	if (rule.cadence === 'monthly') {
		for (const month of monthsFromMask(rule.monthMask)) {
			for (let year = fromYear; year <= toYear; year++) {
				windows.push({
					opensOn: startOfMonth(year, month),
					closesOn: endOfMonth(year, month),
					seasonYear: year,
					key: `${year}-${String(month).padStart(2, '0')}`,
				});
			}
		}
	} else {
		for (const run of maskRuns(rule.monthMask)) {
			// A run that ends before it starts has wrapped through December.
			const wraps = run.end < run.start;
			for (let year = fromYear; year <= toYear; year++) {
				windows.push({
					opensOn: startOfMonth(year, run.start),
					closesOn: endOfMonth(wraps ? year + 1 : year, run.end),
					seasonYear: year,
					key: `${year}-w${run.start}`,
				});
			}
		}
	}

	return windows.sort((a, b) => a.opensOn.localeCompare(b.opensOn));
}

function stateFor(
	window: Window,
	log: LogInput | undefined,
	today: IsoDate,
	upcomingFrom: IsoDate,
): OccurrenceState {
	if (log) return 'done';
	if (today > window.closesOn) return 'overdue';
	if (today >= window.opensOn) return 'due';
	return window.opensOn <= upcomingFrom ? 'upcoming' : 'future';
}

export type ExpandOptions = {
	today?: IsoDate;
	/** Only windows overlapping this span are returned. */
	from?: IsoDate;
	to?: IsoDate;
};

export function expandOccurrences(
	rules: EffectiveRule[],
	logs: LogInput[],
	options: ExpandOptions = {},
): Occurrence[] {
	const today = options.today ?? todayInGarden();
	const from = options.from ?? `${yearOf(today) - 1}-01-01`;
	const to = options.to ?? `${yearOf(today) + 1}-12-31`;
	const upcomingFrom = addDaysIso(today, UPCOMING_DAYS);

	const occurrences: Occurrence[] = [];

	for (const rule of rules) {
		// A completion is logged against whichever alternative was actually
		// done, so any of the group's rules can satisfy the job.
		const mine = logs.filter(
			(l) => l.careRuleId !== null && rule.ruleIds.includes(l.careRuleId),
		);

		for (const window of windowsForRule(rule, yearOf(from) - 1, yearOf(to))) {
			if (window.closesOn < from || window.opensOn > to) continue;

			const log = mine.find((l) => l.occurrenceKey === window.key);
			occurrences.push({
				rule,
				opensOn: window.opensOn,
				closesOn: window.closesOn,
				seasonYear: window.seasonYear,
				key: window.key,
				state: stateFor(window, log, today, upcomingFrom),
				completedOn: log?.completedOn ?? null,
				logId: log?.id ?? null,
			});
		}
	}

	return occurrences.sort(
		(a, b) =>
			a.opensOn.localeCompare(b.opensOn) ||
			a.rule.action.localeCompare(b.rule.action),
	);
}

/**
 * Harvest windows that are open right now. These are a state, not a job: you
 * are picking, or you are not, and there is nothing to tick off.
 */
export function openSeasons(
	rules: EffectiveRule[],
	today: IsoDate = todayInGarden(),
): { rule: EffectiveRule; opensOn: IsoDate; closesOn: IsoDate }[] {
	const month = Number(today.slice(5, 7)) as Month;
	const year = yearOf(today);
	const open: { rule: EffectiveRule; opensOn: IsoDate; closesOn: IsoDate }[] = [];

	for (const rule of rules) {
		if (rule.cadence !== 'continuous') continue;
		for (const run of maskRuns(rule.monthMask)) {
			if (!runContains(run, month)) continue;
			const wraps = run.end < run.start;
			// If the run wrapped and we are in its tail, it opened last year.
			const openedLastYear = wraps && month <= run.end;
			const openYear = openedLastYear ? year - 1 : year;
			open.push({
				rule,
				opensOn: startOfMonth(openYear, run.start),
				closesOn: endOfMonth(wraps ? openYear + 1 : openYear, run.end),
			});
		}
	}
	return open;
}

function runContains(run: { start: Month; end: Month }, month: Month): boolean {
	return run.end < run.start
		? month >= run.start || month <= run.end
		: month >= run.start && month <= run.end;
}

/** Local to this module so `expand` stays free of date-library imports. */
function addDaysIso(date: IsoDate, days: number): IsoDate {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}
