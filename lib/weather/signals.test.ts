/**
 * Weather signals. Pure judgement about numbers, so worth pinning down.
 */
import { describe, expect, it } from 'vitest';
import { conditionOf, signalsFrom } from './signals';
import type { Forecast, ForecastDay } from './types';

function forecast(days: Partial<Forecast['days'][number]>[]): Forecast {
	return {
		fetchedFor: '2026-09-25',
		source: 'bom',
		days: days.map((d, i) => ({
			date: `2026-09-${String(25 + i).padStart(2, '0')}`,
			maxC: 20,
			minC: 12,
			rainMm: 0,
			windKph: 10,
			...d,
		})),
	};
}

describe('weather signals', () => {
	it('says nothing about an ordinary week', () => {
		expect(signalsFrom(forecast([{}, {}, {}]))).toEqual([]);
	});

	it('warns about a frost, loudly', () => {
		const [signal] = signalsFrom(forecast([{ minC: 1 }]));
		expect(signal.kind).toBe('frost');
		expect(signal.message).toContain('frost');
	});

	it('treats a merely cold night as a lesser thing', () => {
		const [signal] = signalsFrom(forecast([{ minC: 4 }]));
		expect(signal.kind).toBe('cold');
		expect(signal.weight).toBeLessThan(100);
	});

	it('distinguishes a hot day from a scorcher', () => {
		expect(signalsFrom(forecast([{ maxC: 34 }]))[0].message).toContain(
			'Water early',
		);
		expect(signalsFrom(forecast([{ maxC: 40 }]))[0].message).toContain('hothouse');
	});

	it('tells you not to bother watering when it rains', () => {
		const [signal] = signalsFrom(forecast([{ rainMm: 8 }]));
		expect(signal.kind).toBe('rain');
		expect(signal.message).toContain('Skip the watering');
	});

	it('says to hold off feeding in a downpour, which would wash through', () => {
		expect(signalsFrom(forecast([{ rainMm: 30 }]))[0].message).toContain('feeding');
	});

	it('puts the frost above the warm afternoon', () => {
		// A week with both: the thing that kills seedlings comes first.
		const signals = signalsFrom(forecast([{ maxC: 34 }, { minC: 0 }]));
		expect(signals[0].kind).toBe('frost');
		expect(signals[1].kind).toBe('heat');
	});

	it('can report more than one thing about one day', () => {
		const signals = signalsFrom(forecast([{ maxC: 39, windKph: 50 }]));
		expect(signals.map((s) => s.kind).sort()).toEqual(['heat', 'wind']);
	});
});

describe('the condition a day gets drawn as', () => {
	const day = (d: Partial<ForecastDay>): ForecastDay => ({
		date: '2026-09-25',
		maxC: 22,
		minC: 12,
		rainMm: 0,
		windKph: 10,
		...d,
	});

	it('draws the sky the provider handed over', () => {
		expect(conditionOf(day({ sky: 'cloud' }))).toBe('cloud');
		expect(conditionOf(day({ sky: 'showers' }))).toBe('showers');
		expect(conditionOf(day({ sky: 'rain' }))).toBe('rain');
		expect(conditionOf(day({ sky: 'storm' }))).toBe('storm');
	});

	it('lets frost overrule anything, because a clear night is when it frosts', () => {
		expect(conditionOf(day({ sky: 'clear', minC: 1 }))).toBe('frost');
		expect(conditionOf(day({ sky: 'rain', minC: 1 }))).toBe('frost');
	});

	it('improves on a clear sky with the thermometer and the wind gauge', () => {
		expect(conditionOf(day({ sky: 'clear', maxC: 35 }))).toBe('hot');
		expect(conditionOf(day({ sky: 'clear', windKph: 55 }))).toBe('windy');
	});

	it('leaves a sky that is already saying something alone', () => {
		// 35 degrees and raining is still a picture of rain.
		expect(conditionOf(day({ sky: 'rain', maxC: 35 }))).toBe('rain');
		expect(conditionOf(day({ sky: 'cloud', windKph: 55 }))).toBe('cloud');
	});

	it('falls back to the numbers when no provider said anything', () => {
		expect(conditionOf(day({}))).toBe('clear');
		expect(conditionOf(day({ rainMm: 12 }))).toBe('rain');
		expect(conditionOf(day({ rainMm: 2 }))).toBe('showers');
		expect(conditionOf(day({ minC: 0 }))).toBe('frost');
		expect(conditionOf(day({ maxC: 36 }))).toBe('hot');
		expect(conditionOf(day({ windKph: 55 }))).toBe('windy');
	});
});
