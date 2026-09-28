/**
 * What each care action is called, and what colour it is.
 *
 * Tailwind cannot build class names at runtime, so every variant is spelled
 * out. This file is the one place that happens: before it existed the same
 * maps lived in TaskCard, MonthGrid, RuleStrip and ProposalReview, and had
 * already drifted apart.
 */
export const ACTION_LABEL: Record<string, string> = {
	fertilise: 'Fertilise',
	prune: 'Prune',
	harvest: 'Harvest',
	sow: 'Sow',
	transplant: 'Transplant',
	thin: 'Thin',
	net: 'Net',
	spray: 'Spray',
	water: 'Water',
	note: 'Note',
};

/**
 * A filled block: grid cells and month strips.
 *
 * Only three of these are coloured, because only three of them are the
 * orchard's colours. net, spray, water and note are grey on purpose - they are
 * real work, but they are not one of the three meanings the palette carries,
 * and pink would make a watering indistinguishable from a harvest.
 */
export const ACTION_FILL: Record<string, string> = {
	fertilise: 'bg-fertilise',
	prune: 'bg-prune',
	harvest: 'bg-harvest',
	sow: 'bg-fertilise',
	transplant: 'bg-fertilise',
	thin: 'bg-prune',
	net: 'bg-rule-strong',
	spray: 'bg-rule-strong',
	water: 'bg-rule-strong',
	note: 'bg-rule-strong',
};

/**
 * The same colours with a legible foreground, for chips carrying a word.
 *
 * ink, not white: the three are pale enough that white on them is 1.9-3.0:1,
 * where ink is 4.2-6.7:1.
 */
export const ACTION_CHIP: Record<string, string> = {
	fertilise: 'bg-fertilise text-ink',
	prune: 'bg-prune text-ink',
	harvest: 'bg-harvest text-ink',
	sow: 'bg-fertilise text-ink',
	transplant: 'bg-fertilise text-ink',
	thin: 'bg-prune text-ink',
	net: 'bg-rule-strong text-ink',
	spray: 'bg-rule-strong text-ink',
	water: 'bg-rule-strong text-ink',
	note: 'bg-rule-strong text-ink',
};

export function actionLabel(action: string): string {
	return ACTION_LABEL[action] ?? action;
}

export function actionFill(action: string): string {
	return ACTION_FILL[action] ?? 'bg-rule-strong';
}

export function actionChip(action: string): string {
	return ACTION_CHIP[action] ?? 'bg-rule-strong text-ink';
}
