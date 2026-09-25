/**
 * The vegetable side of the garden: four beds, a hothouse, and a starter set
 * of crops.
 *
 * A caution about the months below. Unlike the orchard, which was transcribed
 * from the household's own spreadsheet, these are general temperate-Australia
 * sowing windows. They are a reasonable place to begin and they are not your
 * garden. Every one of them is meant to be corrected - either by hand in the
 * rule editor, or by asking Claude to research it properly, which is what the
 * lookup is for. Each plant's notes say so.
 *
 * The hothouse runs a month ahead: anything without a hothouse-specific rule
 * has its windows shifted by the environment, so the same tomato reads
 * differently inside and out without being entered twice.
 */
import type { SeedEnvironmentInput, SeedPlantTypeInput } from './schema';

export const vegEnvironments: SeedEnvironmentInput[] = [
	{
		slug: 'hothouse',
		kind: 'hothouse',
		name: 'The Hothouse',
		sortOrder: 1,
		frostFree: true,
		// Sow a month earlier inside than out.
		windowShiftMonths: -1,
		gridCols: 4,
		gridRows: 2,
		notes:
			'Frost free, and about a month ahead of the open garden. Windows that do not name the hothouse are shifted to match.',
	},
	{
		slug: 'bed-1',
		kind: 'bed',
		name: 'Bed 1',
		sortOrder: 2,
		widthCm: 120,
		lengthCm: 240,
		gridCols: 4,
		gridRows: 2,
	},
	{
		slug: 'bed-2',
		kind: 'bed',
		name: 'Bed 2',
		sortOrder: 3,
		widthCm: 120,
		lengthCm: 240,
		gridCols: 4,
		gridRows: 2,
	},
	{
		slug: 'bed-3',
		kind: 'bed',
		name: 'Bed 3',
		sortOrder: 4,
		widthCm: 120,
		lengthCm: 240,
		gridCols: 4,
		gridRows: 2,
	},
];

const STARTER_NOTE =
	'Sowing months are a general temperate-Australia guide, not this garden yet. Correct them here or ask figgy to look the crop up properly.';

export const vegPlantTypes: SeedPlantTypeInput[] = [
	{
		slug: 'tomato',
		commonName: 'Tomato',
		scientificName: 'Solanum lycopersicum',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Solanaceae',
		notesMd: `Sow under cover from late winter, plant out once frost has passed.\n\n${STARTER_NOTE}`,
		needsReview: false,
		daysToMaturityMin: 70,
		daysToMaturityMax: 90,
		spacingCm: 50,
		plantings: [],
		rules: [
			{ action: 'sow', months: [8, 9, 10], cadence: 'monthly' },
			{ action: 'transplant', months: [10, 11], cadence: 'once_in_window' },
			{ action: 'harvest', months: [12, 1, 2, 3, 4], cadence: 'continuous' },
		],
	},
	{
		slug: 'dwarf-bean',
		commonName: 'Dwarf bean',
		scientificName: 'Phaseolus vulgaris',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Fabaceae',
		notesMd: `Sow direct in warm soil; sow again every few weeks for a run of picking.\n\n${STARTER_NOTE}`,
		needsReview: false,
		daysToMaturityMin: 60,
		daysToMaturityMax: 75,
		spacingCm: 20,
		plantings: [],
		rules: [
			{ action: 'sow', months: [9, 10, 11, 12, 1], cadence: 'monthly' },
			{ action: 'harvest', months: [11, 12, 1, 2, 3], cadence: 'continuous' },
		],
	},
	{
		slug: 'lettuce',
		commonName: 'Lettuce',
		scientificName: 'Lactuca sativa',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Asteraceae',
		notesMd: `Bolts in the heat. Sow either side of summer rather than through it.\n\n${STARTER_NOTE}`,
		needsReview: false,
		daysToMaturityMin: 50,
		daysToMaturityMax: 70,
		spacingCm: 25,
		plantings: [],
		rules: [
			{ action: 'sow', months: [2, 3, 4, 8, 9, 10], cadence: 'monthly' },
			{ action: 'harvest', months: [4, 5, 6, 10, 11, 12], cadence: 'continuous' },
		],
	},
	{
		slug: 'carrot',
		commonName: 'Carrot',
		scientificName: 'Daucus carota',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Apiaceae',
		notesMd: `Sow direct - they dislike being moved. Thin early or they stay small.\n\n${STARTER_NOTE}`,
		needsReview: false,
		daysToMaturityMin: 70,
		daysToMaturityMax: 100,
		spacingCm: 5,
		plantings: [],
		rules: [
			{ action: 'sow', months: [2, 3, 8, 9, 10, 11], cadence: 'monthly' },
			{ action: 'thin', months: [3, 4, 9, 10, 11, 12], cadence: 'monthly' },
			{ action: 'harvest', months: [5, 6, 11, 12, 1, 2], cadence: 'continuous' },
		],
	},
	{
		slug: 'zucchini',
		commonName: 'Zucchini',
		scientificName: 'Cucurbita pepo',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Cucurbitaceae',
		notesMd: `Two plants feed a street. Pick small and often.\n\n${STARTER_NOTE}`,
		needsReview: false,
		daysToMaturityMin: 50,
		daysToMaturityMax: 65,
		spacingCm: 80,
		plantings: [],
		rules: [
			{ action: 'sow', months: [9, 10, 11, 12], cadence: 'monthly' },
			{ action: 'harvest', months: [12, 1, 2, 3], cadence: 'continuous' },
		],
	},
	{
		slug: 'pumpkin',
		commonName: 'Pumpkin',
		scientificName: 'Cucurbita maxima',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Cucurbitaceae',
		notesMd: `Wants room and a long season. Leave on the vine until the stem dries.\n\n${STARTER_NOTE}`,
		needsReview: false,
		daysToMaturityMin: 100,
		daysToMaturityMax: 140,
		spacingCm: 150,
		plantings: [],
		rules: [
			{ action: 'sow', months: [9, 10, 11], cadence: 'monthly' },
			{ action: 'harvest', months: [3, 4, 5], cadence: 'continuous' },
		],
	},
	{
		slug: 'silverbeet',
		commonName: 'Silverbeet',
		scientificName: 'Beta vulgaris',
		category: 'vegetable',
		lifecycle: 'biennial',
		family: 'Amaranthaceae',
		notesMd: `Close to indestructible. Pick outer leaves and it keeps going for months.\n\n${STARTER_NOTE}`,
		needsReview: false,
		daysToMaturityMin: 55,
		daysToMaturityMax: 70,
		spacingCm: 30,
		plantings: [],
		rules: [
			{ action: 'sow', months: [2, 3, 4, 8, 9, 10], cadence: 'monthly' },
			{
				action: 'harvest',
				months: [4, 5, 6, 7, 8, 9, 10, 11, 12],
				cadence: 'continuous',
			},
		],
	},
	{
		slug: 'pea',
		commonName: 'Pea',
		scientificName: 'Pisum sativum',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Fabaceae',
		notesMd: `A cool-season crop here. Give it something to climb.\n\n${STARTER_NOTE}`,
		needsReview: false,
		daysToMaturityMin: 60,
		daysToMaturityMax: 80,
		spacingCm: 8,
		plantings: [],
		rules: [
			{ action: 'sow', months: [3, 4, 5, 8], cadence: 'monthly' },
			{ action: 'harvest', months: [7, 8, 9, 10, 11], cadence: 'continuous' },
		],
	},
	{
		slug: 'garlic',
		commonName: 'Garlic',
		scientificName: 'Allium sativum',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Amaryllidaceae',
		notesMd: `In on the shortest day, out on the longest, roughly. A long occupier of a bed.\n\n${STARTER_NOTE}`,
		needsReview: false,
		daysToMaturityMin: 210,
		daysToMaturityMax: 260,
		spacingCm: 15,
		plantings: [],
		rules: [
			{ action: 'sow', months: [4, 5], cadence: 'once_in_window' },
			{ action: 'harvest', months: [11, 12], cadence: 'continuous' },
		],
	},
	{
		slug: 'basil',
		commonName: 'Basil',
		scientificName: 'Ocimum basilicum',
		category: 'herb',
		lifecycle: 'annual',
		family: 'Lamiaceae',
		notesMd: `Hates cold soil. Happier in the hothouse at either end of the season.\n\n${STARTER_NOTE}`,
		needsReview: false,
		daysToMaturityMin: 60,
		daysToMaturityMax: 80,
		spacingCm: 25,
		plantings: [],
		rules: [
			{ action: 'sow', months: [9, 10, 11, 12], cadence: 'monthly' },
			{ action: 'harvest', months: [12, 1, 2, 3, 4], cadence: 'continuous' },
		],
	},
];
