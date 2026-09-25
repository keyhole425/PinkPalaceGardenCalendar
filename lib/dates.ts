/**
 * All date handling in figgy goes through this file.
 *
 * Dates are stored and passed around as plain 'YYYY-MM-DD' strings, never as
 * timestamps. The garden runs on calendar days, not instants, and Adelaide's
 * half-hour UTC offset (+9:30/+10:30) turns naive UTC arithmetic into
 * off-by-one-day bugs. The timezone is consulted in exactly one place: working
 * out what "today" is.
 */
import { TZDate } from '@date-fns/tz';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Month } from './schedule/months';

export const GARDEN_TIMEZONE = 'Australia/Adelaide';

/** A calendar date with no time and no zone: 'YYYY-MM-DD'. */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
	return ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));
}

export function assertIsoDate(value: string): IsoDate {
	if (!isIsoDate(value)) {
		throw new TypeError(`Not a YYYY-MM-DD date: ${value}`);
	}
	return value;
}

/**
 * Today, in the garden's timezone.
 *
 * FIGGY_TODAY overrides it, which is how the tests and a manual walk-through
 * look at the schedule from another month without changing the clock.
 */
export function today(): IsoDate {
	const override = process.env.FIGGY_TODAY;
	if (override) {
		return assertIsoDate(override);
	}
	return format(new TZDate(Date.now(), GARDEN_TIMEZONE), 'yyyy-MM-dd');
}

export function monthOf(date: IsoDate): Month {
	return Number(date.slice(5, 7)) as Month;
}

export function yearOf(date: IsoDate): number {
	return Number(date.slice(0, 4));
}

export function plusDays(date: IsoDate, days: number): IsoDate {
	return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
	return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/** First day of a month, as a date string. */
export function startOfMonth(year: number, month: Month): IsoDate {
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
}

/** Last day of a month, as a date string. */
export function endOfMonth(year: number, month: Month): IsoDate {
	// Day 0 of the next month is the last day of this one.
	const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Australian reading order: 14 March 2026. */
export function formatLong(date: IsoDate): string {
	return format(parseISO(date), 'd MMMM yyyy');
}

/** Short Australian format: 14/03/2026. */
export function formatShort(date: IsoDate): string {
	return format(parseISO(date), 'dd/MM/yyyy');
}
