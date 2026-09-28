/**
 * The Bureau of Meteorology's own forecast for Adelaide.
 *
 * This is the official local forecast, with a forecaster's hand in it, rather
 * than a global model interpolated to a grid square - which is exactly what
 * you want for the one signal that matters most here. Adelaide's plains rarely
 * frost hard while the hills do, and a model cell does not know that.
 *
 * LICENCE. This reads the Bureau's published XML product, whose stated terms
 * (bom.gov.au/copyright) permit downloading and using the content for personal
 * use. figgy is one household's garden notebook, which is that. Note that this
 * is NOT true of api.weather.bom.gov.au - the JSON endpoint behind the Bureau's
 * own website and app - which returns "You must not use, copy or share it" in
 * every response. Do not be tempted by its nicer shape.
 *
 * What the product does not carry is wind: there is no wind element anywhere
 * in the file, at any period. Open-Meteo fills that in, and fills in any day
 * the Bureau leaves incomplete. See index.ts.
 */
import type { IsoDate } from '@/lib/dates';
import type { Sky } from './types';

/**
 * The South Australian precis forecast, and Adelaide's area within it.
 *
 * These two pin the forecast to the same place as GARDEN_LOCALE in
 * lib/ai/locale.ts. If the garden ever moves, both have to move together.
 */
const PRODUCT = 'IDS10044';
const AREA = 'SA_PT001';
const URL = `https://www.bom.gov.au/fwo/${PRODUCT}.xml`;

/**
 * The Bureau's icon numbers, collapsed onto the six skies figgy can draw.
 *
 * Haze, fog and dust all become "cloud" - not literally true, but they are
 * the same thing to look at and the same thing to garden in: an obscured sky.
 * 9 is "windy", which says nothing about the sky at all and is deliberately
 * left out, so that the wind speed decides instead.
 */
const ICON: Record<number, Sky> = {
	1: 'clear',
	2: 'clear',
	3: 'cloud',
	4: 'cloud',
	6: 'cloud',
	10: 'cloud',
	13: 'cloud',
	8: 'showers',
	11: 'showers',
	17: 'showers',
	12: 'rain',
	18: 'rain',
	14: 'frost',
	15: 'frost',
	16: 'storm',
	19: 'storm',
};

/** A complete day from the Bureau. Wind is not here because it is not there. */
export type BomDay = {
	date: IsoDate;
	maxC: number;
	minC: number;
	rainMm: number;
	sky?: Sky;
};

/**
 * One element or text node out of a forecast period.
 *
 * Hand-rolled rather than parsed, because this is a machine-generated product
 * against a published schema, figgy has no XML parser and does not want one
 * for a single file, and every failure path here ends in `null` and a
 * fall back to Open-Meteo rather than a broken page. The fixture test is what
 * keeps that honest.
 */
function field(period: string, type: string): string | null {
	const match = period.match(
		new RegExp(`<(?:element|text) type="${type}"[^>]*>([^<]*)<`),
	);
	return match ? match[1].trim() : null;
}

function number(period: string, type: string): number | null {
	const raw = field(period, type);
	if (raw === null) return null;
	const value = Number(raw);
	return Number.isFinite(value) ? value : null;
}

/**
 * "3 to 10 mm" as a single number.
 *
 * The middle of the band. The Bureau forecasts rain as a range because that is
 * what it honestly knows; the top of it would have figgy telling you to skip
 * the watering on the strength of the wettest afternoon it could imagine, and
 * the bottom would have it never saying anything at all. An omitted range
 * means no rain worth naming, which is a real zero rather than a missing one.
 */
export function rainFrom(range: string | null): number {
	if (!range) return 0;
	const numbers = range.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
	if (numbers.length === 0) return 0;
	const low = numbers[0];
	const high = numbers[numbers.length - 1];
	return (low + high) / 2;
}

/**
 * Pull Adelaide's complete days out of the product.
 *
 * Periods without both temperatures are dropped. The first one is usually the
 * rest of today - the Bureau issues in the afternoon, by which point today's
 * maximum has already happened - and half a day is not a day. Open-Meteo
 * supplies today in that case.
 */
export function parseBom(xml: string): BomDay[] {
	const area = xml.match(
		new RegExp(`<area[^>]*aac="${AREA}"[\\s\\S]*?</area>`),
	)?.[0];
	if (!area) return [];

	const days: BomDay[] = [];
	for (const period of area.match(
		/<forecast-period\b[^>]*>[\s\S]*?<\/forecast-period>/g,
	) ?? []) {
		const date = period.match(/start-time-local="(\d{4}-\d{2}-\d{2})/)?.[1];
		const maxC = number(period, 'air_temperature_maximum');
		const minC = number(period, 'air_temperature_minimum');
		if (!date || maxC === null || minC === null) continue;

		const icon = number(period, 'forecast_icon_code');
		days.push({
			date,
			maxC,
			minC,
			rainMm: rainFrom(field(period, 'precipitation_range')),
			sky: icon === null ? undefined : ICON[icon],
		});
	}
	return days;
}

/** The week from the Bureau, or nothing at all - which is survivable. */
export async function fetchBom(): Promise<BomDay[] | null> {
	try {
		const response = await fetch(URL, { signal: AbortSignal.timeout(8000) });
		if (!response.ok) return null;
		const days = parseBom(await response.text());
		return days.length > 0 ? days : null;
	} catch {
		return null;
	}
}
