/**
 * Month masks.
 *
 * A care window is a 12-bit integer: bit (m - 1) is set when month m is in the
 * window. January is 1, December is 12. Nothing here knows about dates - that
 * keeps year-wrapping windows ("November to February") from needing any special
 * handling at all.
 */

export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const ALL_MONTHS: Month[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const MONTH_NAMES = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
] as const;

export const MONTH_ABBR = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
] as const;

export function monthName(m: Month): string {
	return MONTH_NAMES[m - 1];
}

export function monthAbbr(m: Month): string {
	return MONTH_ABBR[m - 1];
}

export const EMPTY_MASK = 0;
export const FULL_MASK = 0xfff;

export function isMonth(value: number): value is Month {
	return Number.isInteger(value) && value >= 1 && value <= 12;
}

/** Build a mask from a list of months. Order and duplicates don't matter. */
export function maskFromMonths(months: readonly number[]): number {
	let mask = EMPTY_MASK;
	for (const m of months) {
		if (!isMonth(m)) {
			throw new RangeError(`Not a month: ${m}`);
		}
		mask |= 1 << (m - 1);
	}
	return mask;
}

/** Expand a mask back to ascending month numbers. */
export function monthsFromMask(mask: number): Month[] {
	const months: Month[] = [];
	for (const m of ALL_MONTHS) {
		if (hasMonth(mask, m)) {
			months.push(m);
		}
	}
	return months;
}

export function hasMonth(mask: number, m: Month): boolean {
	return (mask & (1 << (m - 1))) !== 0;
}

export function withMonth(mask: number, m: Month): number {
	return mask | (1 << (m - 1));
}

export function withoutMonth(mask: number, m: Month): number {
	return mask & ~(1 << (m - 1));
}

export function toggleMonth(mask: number, m: Month): number {
	return mask ^ (1 << (m - 1));
}

export function countMonths(mask: number): number {
	let n = 0;
	for (let bit = 0; bit < 12; bit++) {
		if (mask & (1 << bit)) n++;
	}
	return n;
}

/** Inclusive range that may wrap the year: range(11, 2) is Nov, Dec, Jan, Feb. */
export function maskFromRange(from: Month, to: Month): number {
	let mask = EMPTY_MASK;
	let m = from;
	for (;;) {
		mask = withMonth(mask, m);
		if (m === to) break;
		m = nextMonth(m);
	}
	return mask;
}

export function nextMonth(m: Month): Month {
	return (m === 12 ? 1 : m + 1) as Month;
}

export function prevMonth(m: Month): Month {
	return (m === 1 ? 12 : m - 1) as Month;
}

/**
 * Rotate a whole window by a number of months, wrapping at the year boundary.
 * Used to shift open-garden windows into a protected environment: the hothouse
 * runs about a month ahead, so its rules shift by -1.
 */
export function shiftMask(mask: number, months: number): number {
	const by = ((months % 12) + 12) % 12;
	if (by === 0) return mask & FULL_MASK;
	return ((mask << by) | (mask >>> (12 - by))) & FULL_MASK;
}

/**
 * Split a mask into its runs of consecutive months, joining a run that crosses
 * December into January. Used for rendering and for "when did this window open".
 */
export function maskRuns(mask: number): { start: Month; end: Month }[] {
	const months = monthsFromMask(mask);
	if (months.length === 0) return [];
	if (months.length === 12) return [{ start: 1, end: 12 }];

	const runs: { start: Month; end: Month }[] = [];
	for (const m of months) {
		const previous = runs.at(-1);
		if (previous && previous.end === prevMonth(m)) {
			previous.end = m;
		} else {
			runs.push({ start: m, end: m });
		}
	}

	// A run ending in December continues into one starting in January.
	const first = runs[0];
	const last = runs.at(-1);
	if (runs.length > 1 && last && first.start === 1 && last.end === 12) {
		last.end = first.end;
		runs.shift();
	}
	return runs;
}

/** Is `m` the first month of the run it belongs to? */
export function isRunStart(mask: number, m: Month): boolean {
	return hasMonth(mask, m) && !hasMonth(mask, prevMonth(m));
}

/**
 * Months in display order. The orchard year reads better starting in July for
 * a southern-hemisphere garden - dormancy, then spring, then harvest - but the
 * original spreadsheet ran January to December, so both are offered.
 */
export function monthsInOrder(startMonth: Month): Month[] {
	const out: Month[] = [];
	let m = startMonth;
	for (let i = 0; i < 12; i++) {
		out.push(m);
		m = nextMonth(m);
	}
	return out;
}
