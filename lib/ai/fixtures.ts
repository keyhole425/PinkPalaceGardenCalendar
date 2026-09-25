/**
 * A proposal shaped exactly as the model returns one.
 *
 * Used by the tests to exercise everything that happens after Claude answers -
 * validation, review, accepting a subset, and what lands in the schedule -
 * without spending money or needing the network.
 */
import type { PlantProposal } from './schema';

export const kaffirLimeProposal: PlantProposal = {
	commonName: 'Kaffir lime',
	scientificName: 'Citrus hystrix',
	category: 'fruit_tree',
	lifecycle: 'perennial',
	family: 'Rutaceae',
	daysToMaturityMin: 0,
	daysToMaturityMax: 0,
	spacingCm: 300,
	notesMd:
		'Grown for its leaves more than its fruit. Frost tender when young; Adelaide winters are usually mild enough but a cold snap will burn new growth.',
	suitability:
		'Well suited to Adelaide with a warm, sheltered spot. Needs protection from frost in its first few winters.',
	rules: [
		{
			action: 'fertilise',
			months: [9, 12, 3],
			alternatives: false,
			cadence: 'monthly',
			note: 'Citrus food, watered in well.',
			confidence: 'high',
			reasoning:
				'Australian citrus guides consistently give three feeds: early spring, mid summer and early autumn.',
			sources: ['https://example.org/citrus-care', 'https://example.org/sa-citrus'],
		},
		{
			action: 'prune',
			months: [8, 9],
			alternatives: true,
			cadence: 'once_in_window',
			note: 'Light shaping only after the last frost.',
			confidence: 'medium',
			reasoning:
				'Sources agree on late winter to early spring but differ on the exact month.',
			sources: ['https://example.org/citrus-care'],
		},
		{
			action: 'harvest',
			months: [1, 2, 3, 4],
			alternatives: false,
			cadence: 'continuous',
			note: 'Pick leaves as needed year round; fruit ripens late summer to autumn.',
			confidence: 'medium',
			reasoning: 'Fruit ripening times vary with the season.',
			sources: ['https://example.org/sa-citrus'],
		},
		{
			action: 'water',
			months: [12, 1, 2],
			alternatives: false,
			cadence: 'monthly',
			note: 'Deep water weekly through the hottest months.',
			confidence: 'low',
			reasoning:
				'No source gave a schedule; this is inferred from the climate rather than found.',
			sources: [],
		},
	],
	caveats: [
		'Sources disagreed on whether to prune before or after flowering.',
		'Nothing found on netting for fruit fly locally.',
	],
};
