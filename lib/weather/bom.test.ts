/**
 * The Bureau's XML, read without an XML parser. Worth pinning down hard.
 */
import { describe, expect, it } from 'vitest';
import { parseBom, rainFrom } from './bom';
import { BOM_SA_PRECIS } from './fixtures';
import { combine } from './index';
import { skyFromCode } from './open-meteo';
import type { ForecastDay } from './types';

describe('reading the precis forecast', () => {
	const days = parseBom(BOM_SA_PRECIS);

	it('finds Adelaide rather than the first forecast in the file', () => {
		// Port Lincoln sits ahead of it in the fixture, 18 degrees colder.
		expect(days[0].maxC).toBe(32);
		expect(days.some((d) => d.maxC === 14)).toBe(false);
	});

	it('drops the first period, which is only the rest of today', () => {
		// Eight periods in, seven whole days out: the Bureau issued at 16:21,
		// by which time today's maximum had already happened.
		expect(days).toHaveLength(7);
		expect(days[0].date).toBe('2026-09-29');
	});

	it('reads the temperatures', () => {
		expect(days[0]).toMatchObject({ date: '2026-09-29', maxC: 32, minC: 19 });
		expect(days[6]).toMatchObject({ date: '2026-10-05', maxC: 21, minC: 10 });
	});

	it('keeps reading across the daylight-saving change', () => {
		// The offset moves from +09:30 to +10:30 midway through the week; the
		// date is the calendar date either way.
		expect(days.map((d) => d.date)).toEqual([
			'2026-09-29',
			'2026-09-30',
			'2026-10-01',
			'2026-10-02',
			'2026-10-03',
			'2026-10-04',
			'2026-10-05',
		]);
	});

	it('turns the icon numbers into skies figgy can draw', () => {
		expect(days[0].sky).toBe('cloud'); // 3, partly cloudy
		expect(days[1].sky).toBe('showers'); // 11, shower or two
	});

	it('takes the middle of a rainfall band, and zero for no band at all', () => {
		expect(days[1].rainMm).toBe(0.5); // "0 to 1 mm"
		expect(days[2].rainMm).toBe(6.5); // "3 to 10 mm"
		expect(days[0].rainMm).toBe(0); // no range element
	});

	it('says nothing about the sky for an icon it has never heard of', () => {
		const [day] = parseBom(`<area aac="SA_PT001">
			<forecast-period index="1" start-time-local="2026-09-29T00:00:00+09:30">
				<element type="forecast_icon_code">97</element>
				<element type="air_temperature_minimum" units="Celsius">9</element>
				<element type="air_temperature_maximum" units="Celsius">19</element>
			</forecast-period>
		</area>`);
		expect(day.sky).toBeUndefined();
	});

	it('comes back empty rather than throwing when handed nonsense', () => {
		expect(parseBom('')).toEqual([]);
		expect(parseBom('<html>503 Service Unavailable</html>')).toEqual([]);
		// The right shape, the wrong place.
		expect(parseBom('<area aac="NSW_PT001"><forecast-period/></area>')).toEqual([]);
	});
});

describe('rainfall bands', () => {
	it('reads the shapes the Bureau actually writes', () => {
		expect(rainFrom('0 to 1 mm')).toBe(0.5);
		expect(rainFrom('15 to 25 mm')).toBe(20);
		expect(rainFrom('5 mm')).toBe(5);
	});

	it('treats a missing band as a real zero, not a missing number', () => {
		expect(rainFrom(null)).toBe(0);
		expect(rainFrom('')).toBe(0);
	});
});

describe('filling the Bureau gaps from Open-Meteo', () => {
	const bom = [
		{ date: '2026-09-29', maxC: 32, minC: 19, rainMm: 0, sky: 'cloud' as const },
		{
			date: '2026-09-30',
			maxC: 25,
			minC: 17,
			rainMm: 0.5,
			sky: 'showers' as const,
		},
	];
	const openMeteo: ForecastDay[] = [
		// Today, which the Bureau's afternoon issue no longer covers.
		{ date: '2026-09-28', maxC: 26, minC: 10, rainMm: 0, windKph: 12 },
		{
			date: '2026-09-29',
			maxC: 30,
			minC: 18,
			rainMm: 4,
			windKph: 45,
			sky: 'clear',
		},
		{ date: '2026-09-30', maxC: 24, minC: 16, rainMm: 2, windKph: 20, sky: 'rain' },
	];

	it('keeps today, which only Open-Meteo knows about', () => {
		const days = combine(bom, openMeteo);
		expect(days.map((d) => d.date)).toEqual([
			'2026-09-28',
			'2026-09-29',
			'2026-09-30',
		]);
		expect(days[0].maxC).toBe(26);
	});

	it('lets the Bureau win on everything it spoke about', () => {
		const [, tomorrow] = combine(bom, openMeteo);
		expect(tomorrow.maxC).toBe(32);
		expect(tomorrow.rainMm).toBe(0);
		expect(tomorrow.sky).toBe('cloud');
	});

	it('takes the wind from Open-Meteo, because the Bureau has none', () => {
		const [, tomorrow] = combine(bom, openMeteo);
		expect(tomorrow.windKph).toBe(45);
	});

	it('still returns the week when Open-Meteo is unreachable', () => {
		const days = combine(bom, []);
		expect(days).toHaveLength(2);
		expect(days[0].windKph).toBe(0);
	});
});

describe('the WMO code table', () => {
	it('knows a clear sky from a cloudy one', () => {
		expect(skyFromCode(0)).toBe('clear');
		expect(skyFromCode(1)).toBe('clear');
		expect(skyFromCode(2)).toBe('cloud');
		expect(skyFromCode(3)).toBe('cloud');
	});

	it('sorts the wet codes into showers, rain and storms', () => {
		expect(skyFromCode(53)).toBe('showers');
		expect(skyFromCode(80)).toBe('showers');
		expect(skyFromCode(61)).toBe('rain');
		expect(skyFromCode(82)).toBe('rain');
		expect(skyFromCode(95)).toBe('storm');
	});

	it('draws snow with the same flake as frost, there being no other', () => {
		expect(skyFromCode(73)).toBe('frost');
		expect(skyFromCode(85)).toBe('frost');
	});

	it('says nothing rather than guessing', () => {
		expect(skyFromCode(undefined)).toBeUndefined();
		expect(skyFromCode(7777)).toBeUndefined();
	});
});
