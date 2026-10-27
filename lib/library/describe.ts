/**
 * Saying when, in a line.
 *
 * The Plants index and the article both need the same few sentences about a
 * plant's months - "Sow Aug–Oct · ready in 70–90 days", "sow now", "in the
 * hothouse, a month earlier" - for a household's own copy and for a library
 * plant it doesn't have yet. They are worked out here from plain rules, so
 * the two can't disagree and a test can hold them to it.
 */
import {
	hasMonth,
	type Month,
	maskRuns,
	monthAbbr,
	shiftMask,
} from '@/lib/schedule/months';

export type RuleLike = {
	action: string;
	monthMask: number;
	altGroup: string | null;
	environmentKind: string | null;
};

export type PlaceLike = {
	name: string;
	kind: string;
	windowShiftMonths: number;
};

/** "Aug–Oct", or "Nov–Feb", or "Feb–Apr, Aug–Oct" for two runs. */
export function monthsText(mask: number): string {
	return maskRuns(mask)
		.map((run) =>
			run.start === run.end
				? monthAbbr(run.start)
				: `${monthAbbr(run.start)}–${monthAbbr(run.end)}`,
		)
		.join(', ');
}

/**
 * One action's window as words. Alternatives - rules sharing an alt group -
 * are a choice, and read as one: "Aug or Sep", not "Aug–Sep".
 */
export function windowText(rules: RuleLike[]): string {
	const choices = rules.filter((r) => r.altGroup !== null);
	if (choices.length > 1)
		return choices.map((r) => monthsText(r.monthMask)).join(' or ');
	return monthsText(rules.reduce((mask, r) => mask | r.monthMask, 0));
}

/** The actions worth a line, in the order a gardener thinks of them. */
const LEAD: [action: string, verb: string][] = [
	['sow', 'Sow'],
	['transplant', 'Plant out'],
	['harvest', 'Pick'],
	['prune', 'Prune'],
	['fertilise', 'Feed'],
];

/** Rules that apply in the open garden; a rule for one kind of place says so itself. */
function general(rules: RuleLike[]): RuleLike[] {
	const open = rules.filter((r) => r.environmentKind === null && r.monthMask !== 0);
	return open.length > 0 ? open : rules.filter((r) => r.monthMask !== 0);
}

/**
 * The line under a plant's name: its first job and how long it takes, or its
 * first two jobs when there is no "how long".
 */
export function hereLine(
	rules: RuleLike[],
	daysMin: number | null,
	daysMax: number | null,
): string {
	const usable = general(rules);
	const jobs = LEAD.flatMap(([action, verb]) => {
		const these = usable.filter((r) => r.action === action);
		return these.length > 0 ? [`${verb} ${windowText(these)}`] : [];
	});
	const parts = jobs.slice(0, 1);
	if (daysMin) {
		parts.push(
			daysMax && daysMax !== daysMin
				? `ready in ${daysMin}–${daysMax} days`
				: `ready in ${daysMin} days`,
		);
	} else if (jobs[1]) {
		parts.push(jobs[1].charAt(0).toLowerCase() + jobs[1].slice(1));
	}
	return parts.join(' · ');
}

/**
 * Whether `action` can be done this month in any of these places, moving
 * each window with its place as the schedule does. A rule naming a kind of
 * place means what it says there, and nothing anywhere else.
 */
export function inSeason(
	rules: RuleLike[],
	action: string,
	places: PlaceLike[],
	month: Month,
): boolean {
	return rules
		.filter((r) => r.action === action)
		.some((rule) =>
			places
				.filter((p) => p.kind !== 'orchard')
				.some((place) => {
					if (rule.environmentKind && rule.environmentKind !== place.kind) {
						return false;
					}
					const shift = rule.environmentKind ? 0 : place.windowShiftMonths;
					return hasMonth(shiftMask(rule.monthMask, shift), month);
				}),
		);
}

function howFar(months: number): string {
	const n = Math.abs(months);
	const amount = n === 1 ? 'a month' : `${n} months`;
	return `${amount} ${months < 0 ? 'earlier' : 'later'}`;
}

/**
 * "In the hothouse, a month earlier: sow Jul–Aug." One line for each place
 * this household has that runs ahead of or behind the open garden.
 */
export function shiftLines(rules: RuleLike[], places: PlaceLike[]): string[] {
	const open = rules.filter((r) => r.environmentKind === null && r.monthMask !== 0);
	const lead = LEAD.find(([action]) => open.some((r) => r.action === action));
	if (!lead) return [];
	const [action, verb] = lead;
	const these = open.filter((r) => r.action === action);

	const seen = new Set<string>();
	return places.flatMap((place) => {
		if (place.kind === 'orchard' || place.windowShiftMonths === 0) return [];
		const key = `${place.name}:${place.windowShiftMonths}`;
		if (seen.has(key)) return [];
		seen.add(key);
		const shifted = these.map((r) => ({
			...r,
			monthMask: shiftMask(r.monthMask, place.windowShiftMonths),
		}));
		return [
			`In ${place.name.toLowerCase()}, ${howFar(place.windowShiftMonths)}: ${verb.toLowerCase()} ${windowText(shifted)}.`,
		];
	});
}
