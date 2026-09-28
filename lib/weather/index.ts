/**
 * The week's weather.
 *
 * Two providers, with the Bureau of Meteorology leading and Open-Meteo filling
 * the gaps it leaves. The Bureau gives the official local forecast for
 * Adelaide but carries no wind at all and issues its first period as the
 * remainder of today; Open-Meteo answers both of those, and becomes the whole
 * forecast on its own if the Bureau is unreachable. Which one answered is
 * carried on the forecast and shown on the card, so a fallback is never
 * silent.
 *
 * See bom.ts for the licence position - it is not the same for the Bureau's
 * two endpoints, and only one of them may be used here.
 */
import { eq } from 'drizzle-orm';
import { type IsoDate, today as todayInGarden } from '@/lib/dates';
import { db } from '@/lib/db/client';
import { meta } from '@/lib/db/schema';
import { type BomDay, fetchBom } from './bom';
import { fetchOpenMeteo } from './open-meteo';
import type { Forecast, ForecastDay } from './types';

export { conditionOf, signalsFrom } from './signals';
export type {
	Condition,
	Forecast,
	ForecastDay,
	ForecastSource,
	Signal,
	SignalKind,
	Sky,
} from './types';

/**
 * Bumped from 'weather' when the second provider arrived: a row cached by the
 * old single-provider code has a different shape, and one stale afternoon is
 * not worth a migration.
 */
const CACHE_KEY = 'weather.v2';

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

/**
 * The Bureau's days, with Open-Meteo's wind written into them.
 *
 * Every date either provider knows about, in order. The Bureau wins wherever
 * it spoke; Open-Meteo supplies the rest, which in practice means today and
 * the wind speed. Exported for the test - the merge is the part with the
 * edges in it.
 */
export function combine(bom: BomDay[], openMeteo: ForecastDay[]): ForecastDay[] {
	const fromBom = new Map(bom.map((day) => [day.date, day]));
	const fromOpenMeteo = new Map(openMeteo.map((day) => [day.date, day]));
	const dates = [...new Set([...fromBom.keys(), ...fromOpenMeteo.keys()])].sort();

	const days: ForecastDay[] = [];
	for (const date of dates) {
		const bureau = fromBom.get(date);
		const other = fromOpenMeteo.get(date);
		if (bureau) {
			days.push({
				date,
				maxC: bureau.maxC,
				minC: bureau.minC,
				rainMm: bureau.rainMm,
				windKph: other?.windKph ?? 0,
				sky: bureau.sky,
			});
		} else if (other) {
			days.push(other);
		}
	}
	return days;
}

/** Once a day is plenty: nobody replans the garden on an hourly forecast. */
export async function getForecast(
	when: IsoDate = todayInGarden(),
): Promise<Forecast | null> {
	const cached = cacheRead(when);
	if (cached) return cached;

	// Asked together: the Bureau's wind gap is filled from the same round trip.
	const [bureau, openMeteo] = await Promise.all([fetchBom(), fetchOpenMeteo()]);

	let forecast: Forecast | null = null;
	if (bureau && bureau.length > 0) {
		forecast = {
			fetchedFor: when,
			source: 'bom',
			days: combine(bureau, openMeteo ?? []),
		};
	} else if (openMeteo && openMeteo.length > 0) {
		forecast = { fetchedFor: when, source: 'open-meteo', days: openMeteo };
	}

	if (!forecast) return null;
	cacheWrite(forecast);
	return forecast;
}
