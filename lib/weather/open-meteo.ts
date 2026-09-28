/**
 * Open-Meteo: the second opinion, and the one that knows about wind.
 *
 * It was figgy's only forecast before the Bureau arrived, and it stays for two
 * reasons. It carries a daily maximum wind speed, which no Bureau forecast
 * product does, and it answers for any day the Bureau leaves incomplete. If
 * the Bureau is unreachable it becomes the whole forecast again, which is why
 * it still returns a full day rather than just a wind speed.
 *
 * Free, no key and no account, for any coordinates on earth.
 */
import { GARDEN_LOCALE } from '@/lib/ai/locale';
import type { ForecastDay, Sky } from './types';

/** The WMO code table, collapsed onto the six skies figgy can draw. */
export function skyFromCode(code: number | undefined): Sky | undefined {
	if (code === undefined) return undefined;
	if (code <= 1) return 'clear';
	if (code === 2 || code === 3 || code === 45 || code === 48) return 'cloud';
	if ((code >= 51 && code <= 57) || code === 80) return 'showers';
	if ((code >= 61 && code <= 67) || code === 81 || code === 82) return 'rain';
	if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'frost';
	if (code >= 95 && code <= 99) return 'storm';
	return undefined;
}

export async function fetchOpenMeteo(): Promise<ForecastDay[] | null> {
	const url = new URL('https://api.open-meteo.com/v1/forecast');
	url.searchParams.set('latitude', String(GARDEN_LOCALE.latitude));
	url.searchParams.set('longitude', String(GARDEN_LOCALE.longitude));
	url.searchParams.set(
		'daily',
		'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code',
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
				weather_code?: number[];
			};
		};
		if (!body.daily?.time) return null;

		return body.daily.time.map((date, i) => ({
			date,
			maxC: body.daily?.temperature_2m_max[i] ?? 0,
			minC: body.daily?.temperature_2m_min[i] ?? 0,
			rainMm: body.daily?.precipitation_sum[i] ?? 0,
			windKph: body.daily?.wind_speed_10m_max[i] ?? 0,
			sky: skyFromCode(body.daily?.weather_code?.[i]),
		}));
	} catch {
		// No forecast is a perfectly good outcome; the rest of figgy is unaffected.
		return null;
	}
}
