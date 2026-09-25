/**
 * The week's weather, and what it means for the garden.
 *
 * Open-Meteo, because it is free, needs no key and no account, and will give
 * a forecast for any coordinates. The signals below are worked out here rather
 * than asked of a model: frost is frost, and a deterministic answer that works
 * offline and costs nothing beats a clever one that needs an API key.
 */
import { eq } from 'drizzle-orm';
import { GARDEN_LOCALE } from '@/lib/ai/locale';
import { type IsoDate, today as todayInGarden } from '@/lib/dates';
import { db } from '@/lib/db/client';
import { meta } from '@/lib/db/schema';

export type ForecastDay = {
	date: IsoDate;
	maxC: number;
	minC: number;
	rainMm: number;
	windKph: number;
};

export type Forecast = {
	fetchedFor: IsoDate;
	days: ForecastDay[];
};

/**
 * Thresholds, in one place so they can be argued with.
 *
 * Adelaide's plains frost lightly and rarely; 2 degrees on the forecast is
 * close enough to worry about tender seedlings.
 */
const FROST_C = 2;
const COLD_C = 5;
const HOT_C = 32;
const SCORCHING_C = 38;
const WET_MM = 5;
const SOAKING_MM = 20;
const WINDY_KPH = 40;

const CACHE_KEY = 'weather';

function cacheRead(when: IsoDate): Forecast | null {
	const row = db.select().from(meta).where(eq(meta.key, CACHE_KEY)).get();
	if (!row) return null;
	try {
		const cached = JSON.parse(row.value) as Forecast;
		return cached.fetchedFor === when ? cached : null;
	} catch {
		return null;
	}
}

function cacheWrite(forecast: Forecast) {
	db.insert(meta)
		.values({ key: CACHE_KEY, value: JSON.stringify(forecast) })
		.onConflictDoUpdate({
			target: meta.key,
			set: { value: JSON.stringify(forecast) },
		})
		.run();
}

/** Once a day is plenty: nobody replans the garden on an hourly forecast. */
export async function getForecast(
	when: IsoDate = todayInGarden(),
): Promise<Forecast | null> {
	const cached = cacheRead(when);
	if (cached) return cached;

	const url = new URL('https://api.open-meteo.com/v1/forecast');
	url.searchParams.set('latitude', String(GARDEN_LOCALE.latitude));
	url.searchParams.set('longitude', String(GARDEN_LOCALE.longitude));
	url.searchParams.set(
		'daily',
		'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
	);
	url.searchParams.set('timezone', GARDEN_LOCALE.timezone);
	url.searchParams.set('forecast_days', '7');

	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
		if (!response.ok) return null;
		const body = (await response.json()) as {
			daily?: {
				time: string[];
				temperature_2m_max: number[];
				temperature_2m_min: number[];
				precipitation_sum: number[];
				wind_speed_10m_max: number[];
			};
		};
		if (!body.daily?.time) return null;

		const forecast: Forecast = {
			fetchedFor: when,
			days: body.daily.time.map((date, i) => ({
				date,
				maxC: body.daily?.temperature_2m_max[i] ?? 0,
				minC: body.daily?.temperature_2m_min[i] ?? 0,
				rainMm: body.daily?.precipitation_sum[i] ?? 0,
				windKph: body.daily?.wind_speed_10m_max[i] ?? 0,
			})),
		};
		cacheWrite(forecast);
		return forecast;
	} catch {
		// No forecast is a perfectly good outcome; the rest of figgy is unaffected.
		return null;
	}
}

export type SignalKind = 'frost' | 'cold' | 'heat' | 'rain' | 'wind';

export type Signal = {
	kind: SignalKind;
	date: IsoDate;
	/** Higher means more worth reading. */
	weight: number;
	message: string;
};

/** What in this week's weather a gardener would actually want telling. */
export function signalsFrom(forecast: Forecast): Signal[] {
	const signals: Signal[] = [];

	for (const day of forecast.days) {
		if (day.minC <= FROST_C) {
			signals.push({
				kind: 'frost',
				date: day.date,
				weight: 100,
				message: `Down to ${day.minC.toFixed(0)}°C — frost is possible. Cover anything tender.`,
			});
		} else if (day.minC <= COLD_C) {
			signals.push({
				kind: 'cold',
				date: day.date,
				weight: 40,
				message: `A cold night at ${day.minC.toFixed(0)}°C. Seedlings will sulk.`,
			});
		}

		if (day.maxC >= SCORCHING_C) {
			signals.push({
				kind: 'heat',
				date: day.date,
				weight: 95,
				message: `${day.maxC.toFixed(0)}°C — water early, and vent the hothouse before it cooks.`,
			});
		} else if (day.maxC >= HOT_C) {
			signals.push({
				kind: 'heat',
				date: day.date,
				weight: 60,
				message: `${day.maxC.toFixed(0)}°C. Water early rather than in the afternoon.`,
			});
		}

		if (day.rainMm >= SOAKING_MM) {
			signals.push({
				kind: 'rain',
				date: day.date,
				weight: 70,
				message: `${day.rainMm.toFixed(0)} mm of rain. No watering needed, and hold off on feeding — it will wash straight through.`,
			});
		} else if (day.rainMm >= WET_MM) {
			signals.push({
				kind: 'rain',
				date: day.date,
				weight: 45,
				message: `${day.rainMm.toFixed(0)} mm of rain. Skip the watering.`,
			});
		}

		if (day.windKph >= WINDY_KPH) {
			signals.push({
				kind: 'wind',
				date: day.date,
				weight: 50,
				message: `${day.windKph.toFixed(0)} km/h winds. Stake what needs staking; don't spray.`,
			});
		}
	}

	return signals.sort(
		(a, b) => b.weight - a.weight || a.date.localeCompare(b.date),
	);
}

/** Today and tomorrow, at a glance. */
export function nextDays(forecast: Forecast, count = 5): ForecastDay[] {
	return forecast.days.slice(0, count);
}
