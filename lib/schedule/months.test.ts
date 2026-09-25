import { describe, expect, it } from 'vitest';
import {
	countMonths,
	FULL_MASK,
	isRunStart,
	maskFromMonths,
	maskFromRange,
	maskRuns,
	monthsFromMask,
	monthsInOrder,
	shiftMask,
	toggleMonth,
} from './months';

describe('masks', () => {
	it('round-trips a discrete window', () => {
		// Lemon fertilise: January, March, September, November.
		const mask = maskFromMonths([1, 3, 9, 11]);
		expect(monthsFromMask(mask)).toEqual([1, 3, 9, 11]);
		expect(countMonths(mask)).toBe(4);
	});

	it('ignores order and duplicates', () => {
		expect(maskFromMonths([9, 3, 3, 1, 11])).toBe(maskFromMonths([1, 3, 9, 11]));
	});

	it('rejects a month that is not a month', () => {
		expect(() => maskFromMonths([0])).toThrow(RangeError);
		expect(() => maskFromMonths([13])).toThrow(RangeError);
	});

	it('toggles a month off and on again', () => {
		const mask = maskFromMonths([5, 6]);
		expect(monthsFromMask(toggleMonth(mask, 6))).toEqual([5]);
		expect(toggleMonth(toggleMonth(mask, 6), 6)).toBe(mask);
	});
});

describe('ranges that wrap the year', () => {
	it('builds a contiguous range', () => {
		expect(monthsFromMask(maskFromRange(5, 8))).toEqual([5, 6, 7, 8]);
	});

	it('builds a range through December into January', () => {
		// Cherry harvest: November to February.
		expect(monthsFromMask(maskFromRange(11, 2))).toEqual([1, 2, 11, 12]);
	});

	it('treats a single month as a range of one', () => {
		expect(monthsFromMask(maskFromRange(9, 9))).toEqual([9]);
	});
});

describe('runs', () => {
	it('finds one run in a contiguous window', () => {
		expect(maskRuns(maskFromMonths([5, 6, 7, 8]))).toEqual([{ start: 5, end: 8 }]);
	});

	it('joins a run crossing the year boundary', () => {
		expect(maskRuns(maskFromMonths([11, 12, 1, 2]))).toEqual([
			{ start: 11, end: 2 },
		]);
	});

	it('keeps separate runs separate', () => {
		expect(maskRuns(maskFromMonths([1, 3, 9, 11]))).toEqual([
			{ start: 1, end: 1 },
			{ start: 3, end: 3 },
			{ start: 9, end: 9 },
			{ start: 11, end: 11 },
		]);
	});

	it('handles the empty and the full year', () => {
		expect(maskRuns(0)).toEqual([]);
		expect(maskRuns(FULL_MASK)).toEqual([{ start: 1, end: 12 }]);
	});

	it('marks the first month of a wrapping run, and only that one', () => {
		const mask = maskFromMonths([11, 12, 1, 2]);
		expect(isRunStart(mask, 11)).toBe(true);
		expect(isRunStart(mask, 12)).toBe(false);
		expect(isRunStart(mask, 1)).toBe(false);
		expect(isRunStart(mask, 2)).toBe(false);
	});
});

describe('shifting a window into another environment', () => {
	it('moves a window a month earlier, as the hothouse does', () => {
		const outside = maskFromMonths([9, 10, 11, 12]);
		expect(monthsFromMask(shiftMask(outside, -1))).toEqual([8, 9, 10, 11]);
	});

	it('wraps around the year rather than dropping months', () => {
		expect(monthsFromMask(shiftMask(maskFromMonths([12]), 1))).toEqual([1]);
		expect(monthsFromMask(shiftMask(maskFromMonths([1]), -1))).toEqual([12]);
	});

	it('preserves how many months a window covers', () => {
		const mask = maskFromMonths([1, 3, 9, 11]);
		for (let by = -12; by <= 12; by++) {
			expect(countMonths(shiftMask(mask, by))).toBe(4);
		}
	});

	it('is a no-op for a whole year or no shift', () => {
		const mask = maskFromMonths([2, 7]);
		expect(shiftMask(mask, 0)).toBe(mask);
		expect(shiftMask(mask, 12)).toBe(mask);
		expect(shiftMask(mask, -12)).toBe(mask);
	});
});

describe('display order', () => {
	it('starts the year where asked and wraps', () => {
		expect(monthsInOrder(7)).toEqual([7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]);
		expect(monthsInOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
	});
});
