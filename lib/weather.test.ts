/**
 * Weather signals. Pure judgement about numbers, so worth pinning down.
 */
import { describe, expect, it } from 'vitest';
import type { Forecast } from './weather';
import { signalsFrom } from './weather';

function forecast(days: Partial<Forecast['days'][number]>[]): Forecast {
	return {
		fetchedFor: '2026-09-25',
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
