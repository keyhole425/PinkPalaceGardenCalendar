/**
 * Where a garden is.
 *
 * One profile per region, injected into every prompt and used to place the
 * web searches. It is the difference between advice for a garden and advice
 * for a magazine: without it a model will happily tell you to prune in March
 * because that is late winter somewhere else. A household's region is on its
 * row; the library keeps its windows per region for the same reason.
 */
import type { RegionId } from '@/lib/db/schema';

export type Locale = {
	city: string;
	region: string;
	country: string;
	timezone: string;
	latitude: number;
	longitude: number;
	hemisphere: 'southern' | 'northern';
	climate: string;
	lastFrost: string;
	firstFrost: string;
	usdaZoneEquivalent: string;
	australianZone: string;
};

export const REGIONS: Record<RegionId, Locale> = {
	adelaide: {
		city: 'Adelaide',
		region: 'South Australia',
		country: 'AU',
		timezone: 'Australia/Adelaide',
		latitude: -34.93,
		longitude: 138.6,
		hemisphere: 'southern',
		climate: 'Mediterranean - hot dry summers, mild wet winters',
		/** Roughly. Adelaide's plains rarely frost hard; the hills do. */
		lastFrost: 'late August',
		firstFrost: 'late May',
		usdaZoneEquivalent: '10a',
		australianZone: 'temperate / warm temperate',
	},
};

/**
 * The weather's place. The forecast is fetched once for the whole site and is
 * Adelaide's for everyone, whatever region a garden keeps its months in.
 */
export const GARDEN_LOCALE = REGIONS.adelaide;

/** The paragraph every prompt starts from. */
export function localeBrief(region: RegionId): string {
	const l = REGIONS[region];
	const seasons =
		l.hemisphere === 'southern'
			? 'winter is June to August and summer is December to February'
			: 'winter is December to February and summer is June to August';
	return [
		`The garden is in ${l.city}, ${l.region}, ${l.country === 'AU' ? 'Australia' : l.country}.`,
		`It is in the ${l.hemisphere} hemisphere: ${seasons}.`,
		`Climate: ${l.climate}.`,
		`Frost is possible between ${l.firstFrost} and ${l.lastFrost}, and is usually light.`,
		`Roughly equivalent to USDA zone ${l.usdaZoneEquivalent}; locally described as ${l.australianZone}.`,
	].join(' ');
}

/** Places the model's web searches near the garden rather than nowhere. */
export function searchLocation(region: RegionId) {
	const l = REGIONS[region];
	return {
		type: 'approximate' as const,
		city: l.city,
		region: l.region,
		country: l.country,
		timezone: l.timezone,
	};
}
