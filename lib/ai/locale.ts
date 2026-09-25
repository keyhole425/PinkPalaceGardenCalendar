/**
 * Where this garden is.
 *
 * One profile, injected into every prompt and used to place the web searches.
 * It is the difference between advice for a garden and advice for a magazine:
 * without it a model will happily tell you to prune in March because that is
 * late winter somewhere else.
 */
export const GARDEN_LOCALE = {
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
} as const;

/** The paragraph every prompt starts from. */
export function localeBrief(): string {
	return [
		`The garden is in ${GARDEN_LOCALE.city}, ${GARDEN_LOCALE.region}, Australia.`,
		`It is in the ${GARDEN_LOCALE.hemisphere} hemisphere: winter is June to August and summer is December to February.`,
		`Climate: ${GARDEN_LOCALE.climate}.`,
		`Frost is possible between ${GARDEN_LOCALE.firstFrost} and ${GARDEN_LOCALE.lastFrost}, and is usually light.`,
		`Roughly equivalent to USDA zone ${GARDEN_LOCALE.usdaZoneEquivalent}; locally described as ${GARDEN_LOCALE.australianZone}.`,
	].join(' ');
}

/** Places the model's web searches near the garden rather than nowhere. */
export const SEARCH_LOCATION = {
	type: 'approximate' as const,
	city: GARDEN_LOCALE.city,
	region: GARDEN_LOCALE.region,
	country: GARDEN_LOCALE.country,
	timezone: GARDEN_LOCALE.timezone,
};
