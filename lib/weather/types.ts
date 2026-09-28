/**
 * The shape of a week's weather, and the numbers figgy judges it by.
 *
 * Kept apart from the two providers so that neither one's vocabulary leaks
 * into the rest of the app. A provider's job is to answer these questions in
 * these units; what the answers mean is decided in signals.ts, once, for all
 * of them.
 */
import type { IsoDate } from '@/lib/dates';

/**
 * What the sky is doing, normalised away from any one provider's code list.
 *
 * The Bureau numbers its icons 1-19 and Open-Meteo uses the WMO code table;
 * neither list is figgy's business. Both get mapped to this at the edge, so a
 * card that draws a cloud is never reading somebody's magic number.
 */
export type Sky = 'clear' | 'cloud' | 'showers' | 'rain' | 'storm' | 'frost';

/** The sky, plus the two things the thermometer and the wind gauge add. */
export type Condition = Sky | 'hot' | 'windy';

export type ForecastDay = {
	date: IsoDate;
	maxC: number;
	minC: number;
	rainMm: number;
	windKph: number;
	/** Absent when the provider said nothing useful; the numbers then decide. */
	sky?: Sky;
};

/** Which forecast this is. Shown on the card, so a fallback is never silent. */
export type ForecastSource = 'bom' | 'open-meteo';

export type Forecast = {
	fetchedFor: IsoDate;
	days: ForecastDay[];
	source: ForecastSource;
};

/**
 * Thresholds, in one place so they can be argued with.
 *
 * Adelaide's plains frost lightly and rarely; 2 degrees on the forecast is
 * close enough to worry about tender seedlings.
 */
export const FROST_C = 2;
export const COLD_C = 5;
export const HOT_C = 32;
export const SCORCHING_C = 38;
export const WET_MM = 5;
export const SOAKING_MM = 20;
export const WINDY_KPH = 40;

export type SignalKind = 'frost' | 'cold' | 'heat' | 'rain' | 'wind';

export type Signal = {
	kind: SignalKind;
	date: IsoDate;
	/** Higher means more worth reading. */
	weight: number;
	message: string;
};
