/**
 * What this week's weather means for the garden.
 *
 * Worked out here rather than asked of a model: frost is frost, and a
 * deterministic answer that works offline and costs nothing beats a clever one
 * that needs an API key. Nothing below knows or cares which provider the
 * numbers came from.
 */
import {
	COLD_C,
	type Condition,
	type Forecast,
	type ForecastDay,
	FROST_C,
	HOT_C,
	SCORCHING_C,
	type Signal,
	SOAKING_MM,
	WET_MM,
	WINDY_KPH,
} from './types';

/** What a gardener would actually want telling about the week ahead. */
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

/**
 * What a day looks like out the window, in one word.
 *
 * Deliberately fewer buckets than either provider's code list: a gardener
 * wants to know whether to water, cover or stay inside, and 'light drizzle'
 * and 'moderate drizzle' are the same answer. Frost outranks the sky entirely,
 * because a clear night is exactly when it frosts.
 */
export function conditionOf(day: ForecastDay): Condition {
	if (day.minC <= FROST_C) return 'frost';

	if (day.sky) {
		// A clear sky is the one the thermometer and the wind gauge can improve on.
		if (day.sky === 'clear') {
			if (day.maxC >= HOT_C) return 'hot';
			if (day.windKph >= WINDY_KPH) return 'windy';
		}
		return day.sky;
	}

	// Nobody said: the numbers alone still say most of it.
	if (day.rainMm >= WET_MM) return 'rain';
	if (day.rainMm >= 1) return 'showers';
	if (day.windKph >= WINDY_KPH) return 'windy';
	if (day.maxC >= HOT_C) return 'hot';
	return 'clear';
}
