/**
 * The Pink Palace orchard, transcribed from ORCHARD SCHEDULE.numbers.
 *
 * Months are written as plain numbers so this file stays readable next to the
 * original spreadsheet: 1 is January. The notes are the gardener's own words,
 * copied across unedited - they say things the grid can't, and they are the
 * most valuable unstructured data in the project.
 *
 * Where the spreadsheet marked cells "OR", the months appear under `anyOf`:
 * those windows are alternatives, and doing any one of them is enough.
 */
import type { SeedEnvironment, SeedPlantType } from './schema';

export const environments: SeedEnvironment[] = [
	{
		slug: 'orchard',
		kind: 'orchard',
		name: 'The Orchard',
		sortOrder: 0,
		frostFree: false,
		windowShiftMonths: 0,
		notes: 'Open ground. Adelaide, South Australia.',
	},
];

export const plantTypes: SeedPlantType[] = [
	{
		slug: 'lemon',
		commonName: 'Lemon',
		scientificName: 'Citrus limon',
		category: 'fruit_tree',
		lifecycle: 'perennial',
		family: 'Rutaceae',
		notesMd: [
			'Harvest late autumn and winter.',
			'Prune late winter to early spring.',
			'Fertilise every 2-3 months September- April.',
		].join('\n'),
		needsReview: false,
		plantings: ['Lemon'],
		rules: [
			{ action: 'fertilise', months: [1, 3, 9, 11], cadence: 'monthly' },
			{ action: 'prune', anyOf: [[8], [9]], cadence: 'once_in_window' },
			{ action: 'harvest', months: [5, 6, 7, 8], cadence: 'continuous' },
		],
	},
	{
		slug: 'olive',
		commonName: 'Olive',
		scientificName: 'Olea europaea',
		category: 'fruit_tree',
		lifecycle: 'perennial',
		family: 'Oleaceae',
		notesMd: [
			'Harvest - late autumn and winter',
			'Prune: late winter to early spring',
			'Fertilise irregularly: September- April. Prefers leaner soils',
		].join('\n'),
		needsReview: false,
		plantings: ['Olive'],
		rules: [
			{ action: 'fertilise', months: [4, 9, 12], cadence: 'monthly' },
			{ action: 'prune', anyOf: [[8], [9]], cadence: 'once_in_window' },
			{ action: 'harvest', months: [5, 6, 7, 8], cadence: 'continuous' },
		],
	},
	{
		slug: 'cherry',
		commonName: 'Cherry',
		scientificName: 'Prunus avium',
		category: 'fruit_tree',
		lifecycle: 'perennial',
		family: 'Rosaceae',
		notesMd: [
			'Harvest - late Spring-Summer',
			'Prune: post harvest end of summer',
			'Fertilise: September Only',
		].join('\n'),
		needsReview: false,
		plantings: ['Cherry #1', 'Cherry #2'],
		rules: [
			{ action: 'fertilise', months: [9], cadence: 'monthly' },
			{ action: 'prune', months: [2], cadence: 'once_in_window' },
			{ action: 'harvest', months: [11, 12, 1, 2], cadence: 'continuous' },
		],
	},
	{
		slug: 'nashi',
		commonName: 'Nashi',
		scientificName: 'Pyrus pyrifolia',
		category: 'fruit_tree',
		lifecycle: 'perennial',
		family: 'Rosaceae',
		notesMd: [
			'Harvest - Autumn',
			'Prune: end of winter in dormancy',
			'Fertilise: September, January and March',
		].join('\n'),
		needsReview: false,
		plantings: ['Nashi #1', 'Nashi #2'],
		rules: [
			{ action: 'fertilise', months: [3, 9, 12], cadence: 'monthly' },
			{ action: 'prune', months: [8], cadence: 'once_in_window' },
			{ action: 'harvest', months: [3, 4, 5], cadence: 'continuous' },
		],
	},
	{
		slug: 'fig',
		commonName: 'Fig',
		scientificName: 'Ficus carica',
		category: 'fruit_tree',
		lifecycle: 'perennial',
		family: 'Moraceae',
		notesMd: [
			'Harvest - late summer and Autumn',
			'Prune: Winter in dormancy',
			'Fertilise: 4-6 weeks spring and summer. Stop in autumn as it heads into dormancy',
		].join('\n'),
		needsReview: false,
		plantings: ['Fig'],
		rules: [
			{
				action: 'fertilise',
				months: [9, 10, 11, 12, 1, 2],
				cadence: 'monthly',
				note: 'The note says every 4-6 weeks through spring and summer; the grid names the months.',
			},
			{ action: 'prune', months: [6], cadence: 'once_in_window' },
			{ action: 'harvest', months: [2, 3, 4, 5], cadence: 'continuous' },
		],
	},
	{
		slug: 'mulberry',
		commonName: 'Mulberry',
		scientificName: 'Morus nigra',
		category: 'fruit_tree',
		lifecycle: 'perennial',
		family: 'Moraceae',
		notesMd: [
			'Harvest - late spring and summer',
			'Prune: hard prune late Winter dormancy',
			'Fertilise: 1 x in early spring, 1 in late summer/early autumn',
		].join('\n'),
		needsReview: false,
		plantings: ['Mulberry'],
		rules: [
			{ action: 'fertilise', months: [2, 9], cadence: 'monthly' },
			{ action: 'prune', months: [8], cadence: 'once_in_window' },
			{ action: 'harvest', months: [11, 12, 1, 2], cadence: 'continuous' },
		],
	},
	{
		slug: 'pomegranate',
		commonName: 'Pomegranate',
		scientificName: 'Punica granatum',
		category: 'fruit_tree',
		lifecycle: 'perennial',
		family: 'Lythraceae',
		notesMd: [
			'Harvest - Autumn',
			'Prune: hard prune late Winter dormancy',
			'Fertilise: 1 x in early spring, 1 in late summer and early autumn',
		].join('\n'),
		needsReview: false,
		plantings: ['Pomegranate'],
		rules: [
			{ action: 'fertilise', months: [2, 9], cadence: 'monthly' },
			{ action: 'prune', months: [8], cadence: 'once_in_window' },
			{ action: 'harvest', months: [3, 4, 5], cadence: 'continuous' },
		],
	},
	{
		slug: 'cumquat',
		commonName: 'Cumquat',
		scientificName: 'Citrus japonica',
		category: 'fruit_tree',
		lifecycle: 'perennial',
		family: 'Rutaceae',
		notesMd: [
			'Harvest - Autumn and winter',
			'Prune: prune late Winter -early spring',
			'Fertilise: 1 x in early spring, 1 in late summer and early autumn',
		].join('\n'),
		needsReview: false,
		plantings: ['Cumquat'],
		rules: [
			{
				action: 'fertilise',
				anyOf: [[2], [3]],
				cadence: 'once_in_window',
				note: 'Late summer / early autumn feed.',
			},
			{ action: 'fertilise', months: [9], cadence: 'monthly' },
			{ action: 'prune', anyOf: [[8], [9]], cadence: 'once_in_window' },
			{ action: 'harvest', months: [3, 4, 5, 6, 7, 8], cadence: 'continuous' },
		],
	},
	{
		slug: 'mandarin',
		commonName: 'Mandarin',
		scientificName: 'Citrus reticulata',
		category: 'fruit_tree',
		lifecycle: 'perennial',
		family: 'Rutaceae',
		notesMd: [
			'Harvest - Late autumn - winter',
			'Prune: August-october light pruning (15-25% only)',
			'Fertilise: September, January and March',
		].join('\n'),
		needsReview: false,
		plantings: ['Mandarin'],
		rules: [
			{ action: 'fertilise', months: [1, 3, 9], cadence: 'monthly' },
			{
				action: 'prune',
				anyOf: [[8], [9], [10]],
				cadence: 'once_in_window',
				note: 'Light pruning only, 15-25%.',
			},
			{ action: 'harvest', months: [5, 6, 7, 8], cadence: 'continuous' },
		],
	},
	{
		slug: 'plum',
		commonName: 'Plum',
		scientificName: 'Prunus domestica',
		category: 'fruit_tree',
		lifecycle: 'perennial',
		family: 'Rosaceae',
		// The spreadsheet has a September fertilise and nothing else. Rather than
		// pretend the tree needs no pruning or picking, it is flagged for review.
		notesMd: undefined,
		needsReview: true,
		plantings: ['Plum'],
		rules: [{ action: 'fertilise', months: [9], cadence: 'monthly' }],
	},
	{
		slug: 'unidentified-tree',
		commonName: 'Unidentified tree',
		category: 'fruit_tree',
		lifecycle: 'perennial',
		// The spreadsheet's last row is labelled "??" with a single September
		// fertilise. Identifying it is the first job for the AI research flow.
		notesMd: 'Listed in the orchard spreadsheet only as "??". Needs identifying.',
		needsReview: true,
		plantings: ['Unidentified tree'],
		rules: [{ action: 'fertilise', months: [9], cadence: 'monthly' }],
	},
];

/** Bumped whenever this file changes; shown in /settings. */
export const SEED_VERSION = '2026-09-25.1';
export const SEED_SOURCE = 'ORCHARD SCHEDULE.numbers';
