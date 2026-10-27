/**
 * The vegetable side of the garden: four beds, a hothouse, and the library's
 * first crops.
 *
 * The crops are written into the shared library, not into any one garden. A
 * household gets its own copy of each one in STARTER_SET, and can add the
 * rest from the library - the chilli and its kinds among them.
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
import type { SeedEnvironmentInput, SeedLibraryPlantInput } from './schema';

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
	'These months are a general temperate-Australia guide, and nobody has checked them against a garden here yet.';

export const vegLibrary: SeedLibraryPlantInput[] = [
	{
		slug: 'tomato',
		commonName: 'Tomato',
		scientificName: 'Solanum lycopersicum',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Solanaceae',
		summary: 'Sow under cover from late winter, plant out once frost has passed.',
		regionNotes: { adelaide: STARTER_NOTE },
		daysToMaturityMin: 70,
		daysToMaturityMax: 90,
		spacingCm: 50,
		rules: {
			adelaide: [
				{ action: 'sow', months: [8, 9, 10], cadence: 'monthly' },
				{ action: 'transplant', months: [10, 11], cadence: 'once_in_window' },
				{ action: 'harvest', months: [12, 1, 2, 3, 4], cadence: 'continuous' },
			],
		},
	},
	{
		slug: 'dwarf-bean',
		commonName: 'Dwarf bean',
		aliases: ['bush bean', 'green bean', 'French bean'],
		scientificName: 'Phaseolus vulgaris',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Fabaceae',
		summary:
			'Sow direct in warm soil; sow again every few weeks for a run of picking.',
		regionNotes: { adelaide: STARTER_NOTE },
		daysToMaturityMin: 60,
		daysToMaturityMax: 75,
		spacingCm: 20,
		rules: {
			adelaide: [
				{ action: 'sow', months: [9, 10, 11, 12, 1], cadence: 'monthly' },
				{ action: 'harvest', months: [11, 12, 1, 2, 3], cadence: 'continuous' },
			],
		},
	},
	{
		slug: 'lettuce',
		commonName: 'Lettuce',
		scientificName: 'Lactuca sativa',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Asteraceae',
		summary: 'Bolts in the heat. Sow either side of summer rather than through it.',
		regionNotes: { adelaide: STARTER_NOTE },
		daysToMaturityMin: 50,
		daysToMaturityMax: 70,
		spacingCm: 25,
		rules: {
			adelaide: [
				{ action: 'sow', months: [2, 3, 4, 8, 9, 10], cadence: 'monthly' },
				{ action: 'harvest', months: [4, 5, 6, 10, 11, 12], cadence: 'continuous' },
			],
		},
	},
	{
		slug: 'carrot',
		commonName: 'Carrot',
		scientificName: 'Daucus carota',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Apiaceae',
		summary:
			'Sow direct - they dislike being moved. Thin early or they stay small.',
		regionNotes: { adelaide: STARTER_NOTE },
		daysToMaturityMin: 70,
		daysToMaturityMax: 100,
		spacingCm: 5,
		rules: {
			adelaide: [
				{ action: 'sow', months: [2, 3, 8, 9, 10, 11], cadence: 'monthly' },
				{ action: 'thin', months: [3, 4, 9, 10, 11, 12], cadence: 'monthly' },
				{ action: 'harvest', months: [5, 6, 11, 12, 1, 2], cadence: 'continuous' },
			],
		},
	},
	{
		slug: 'zucchini',
		commonName: 'Zucchini',
		aliases: ['courgette'],
		scientificName: 'Cucurbita pepo',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Cucurbitaceae',
		summary: 'Two plants feed a street. Pick small and often.',
		regionNotes: { adelaide: STARTER_NOTE },
		daysToMaturityMin: 50,
		daysToMaturityMax: 65,
		spacingCm: 80,
		rules: {
			adelaide: [
				{ action: 'sow', months: [9, 10, 11, 12], cadence: 'monthly' },
				{ action: 'harvest', months: [12, 1, 2, 3], cadence: 'continuous' },
			],
		},
	},
	{
		slug: 'pumpkin',
		commonName: 'Pumpkin',
		scientificName: 'Cucurbita maxima',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Cucurbitaceae',
		summary:
			'Wants room and a long season. Leave on the vine until the stem dries.',
		regionNotes: { adelaide: STARTER_NOTE },
		daysToMaturityMin: 100,
		daysToMaturityMax: 140,
		spacingCm: 150,
		rules: {
			adelaide: [
				{ action: 'sow', months: [9, 10, 11], cadence: 'monthly' },
				{ action: 'harvest', months: [3, 4, 5], cadence: 'continuous' },
			],
		},
	},
	{
		slug: 'silverbeet',
		commonName: 'Silverbeet',
		aliases: ['chard', 'Swiss chard'],
		scientificName: 'Beta vulgaris',
		category: 'vegetable',
		lifecycle: 'biennial',
		family: 'Amaranthaceae',
		summary:
			'Close to indestructible. Pick outer leaves and it keeps going for months.',
		regionNotes: { adelaide: STARTER_NOTE },
		daysToMaturityMin: 55,
		daysToMaturityMax: 70,
		spacingCm: 30,
		rules: {
			adelaide: [
				{ action: 'sow', months: [2, 3, 4, 8, 9, 10], cadence: 'monthly' },
				{
					action: 'harvest',
					months: [4, 5, 6, 7, 8, 9, 10, 11, 12],
					cadence: 'continuous',
				},
			],
		},
	},
	{
		slug: 'pea',
		commonName: 'Pea',
		aliases: ['snow pea', 'sugar snap'],
		scientificName: 'Pisum sativum',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Fabaceae',
		summary: 'A cool-season crop here. Give it something to climb.',
		regionNotes: { adelaide: STARTER_NOTE },
		daysToMaturityMin: 60,
		daysToMaturityMax: 80,
		spacingCm: 8,
		rules: {
			adelaide: [
				{ action: 'sow', months: [3, 4, 5, 8], cadence: 'monthly' },
				{ action: 'harvest', months: [7, 8, 9, 10, 11], cadence: 'continuous' },
			],
		},
	},
	{
		slug: 'garlic',
		commonName: 'Garlic',
		scientificName: 'Allium sativum',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Amaryllidaceae',
		summary:
			'In on the shortest day, out on the longest, roughly. A long occupier of a bed.',
		regionNotes: { adelaide: STARTER_NOTE },
		daysToMaturityMin: 210,
		daysToMaturityMax: 260,
		spacingCm: 15,
		rules: {
			adelaide: [
				{ action: 'sow', months: [4, 5], cadence: 'once_in_window' },
				{ action: 'harvest', months: [11, 12], cadence: 'continuous' },
			],
		},
	},
	{
		slug: 'basil',
		commonName: 'Basil',
		scientificName: 'Ocimum basilicum',
		category: 'herb',
		lifecycle: 'annual',
		family: 'Lamiaceae',
		summary:
			'Hates cold soil. Happier in the hothouse at either end of the season.',
		regionNotes: { adelaide: STARTER_NOTE },
		daysToMaturityMin: 60,
		daysToMaturityMax: 80,
		spacingCm: 25,
		rules: {
			adelaide: [
				{ action: 'sow', months: [9, 10, 11, 12], cadence: 'monthly' },
				{ action: 'harvest', months: [12, 1, 2, 3, 4], cadence: 'continuous' },
			],
		},
	},

	/*
	 * Chilli, and three of its kinds. The parent is a gardener's group rather
	 * than a botanical one - habanero and the Reaper are Capsicum chinense,
	 * bird's eye is C. annuum - so each kind carries its own scientific name.
	 * A kind lists only what differs: bird's eye keeps the chilli's months.
	 */
	{
		slug: 'chilli',
		commonName: 'Chilli',
		scientificName: 'Capsicum',
		aliases: ['chili', 'hot pepper'],
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Solanaceae',
		summary:
			'Wants warm soil and a long, hot season. Sow under cover in late winter and plant out once frost has passed.',
		regionNotes: { adelaide: STARTER_NOTE },
		needsReview: true,
		daysToMaturityMin: 70,
		daysToMaturityMax: 100,
		spacingCm: 45,
		rules: {
			adelaide: [
				{ action: 'sow', months: [8, 9, 10], cadence: 'monthly' },
				{ action: 'transplant', months: [10, 11], cadence: 'once_in_window' },
				{ action: 'harvest', months: [1, 2, 3, 4, 5], cadence: 'continuous' },
			],
		},
	},
	{
		slug: 'habanero',
		parent: 'chilli',
		commonName: 'Habanero',
		scientificName: 'Capsicum chinense',
		summary:
			'Very hot, and slow to germinate and to ripen. Sow at the start of the window.',
		needsReview: true,
		daysToMaturityMin: 90,
		daysToMaturityMax: 120,
		rules: {
			adelaide: [
				{ action: 'sow', months: [8, 9], cadence: 'monthly' },
				{ action: 'harvest', months: [2, 3, 4, 5], cadence: 'continuous' },
			],
		},
	},
	{
		slug: 'birds-eye-chilli',
		parent: 'chilli',
		commonName: 'Bird’s eye chilli',
		scientificName: 'Capsicum annuum',
		aliases: ['bird’s eye', 'birds eye', 'Thai chilli'],
		summary:
			'Small, upright and prolific. In a pot against a warm wall it often lives through an Adelaide winter.',
		needsReview: true,
		daysToMaturityMin: 70,
		daysToMaturityMax: 90,
		spacingCm: 40,
	},
	{
		slug: 'carolina-reaper',
		parent: 'chilli',
		commonName: 'Carolina Reaper',
		scientificName: 'Capsicum chinense',
		aliases: ['reaper'],
		summary:
			'Among the hottest chillies grown, and the slowest. Sow early, give it the warmest spot, and wear gloves to pick.',
		needsReview: true,
		daysToMaturityMin: 100,
		daysToMaturityMax: 130,
		rules: {
			adelaide: [
				{ action: 'sow', months: [7, 8], cadence: 'monthly' },
				{ action: 'harvest', months: [3, 4, 5], cadence: 'continuous' },
			],
		},
	},
];

/** What every new garden starts with a copy of. The rest it adds from the library. */
export const STARTER_SET = [
	'tomato',
	'dwarf-bean',
	'lettuce',
	'carrot',
	'zucchini',
	'pumpkin',
	'silverbeet',
	'pea',
	'garlic',
	'basil',
] as const;
