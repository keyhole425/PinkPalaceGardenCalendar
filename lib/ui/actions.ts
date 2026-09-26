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

/** A filled block: grid cells and month strips. */
export const ACTION_FILL: Record<string, string> = {
	fertilise: 'bg-fertilise',
	prune: 'bg-prune',
	harvest: 'bg-harvest',
	sow: 'bg-fertilise',
	transplant: 'bg-fertilise',
	thin: 'bg-prune',
	net: 'bg-palace-500',
	spray: 'bg-palace-500',
	water: 'bg-palace-500',
	note: 'bg-palace-500',
};

/** The same colours with a legible foreground, for chips carrying a word. */
export const ACTION_CHIP: Record<string, string> = {
	fertilise: 'bg-fertilise text-white',
	prune: 'bg-prune text-white',
	harvest: 'bg-harvest text-white',
	sow: 'bg-fertilise text-white',
	transplant: 'bg-fertilise text-white',
	thin: 'bg-prune text-white',
	net: 'bg-palace-500 text-white',
	spray: 'bg-palace-500 text-white',
	water: 'bg-palace-500 text-white',
	note: 'bg-palace-500 text-white',
};

export function actionLabel(action: string): string {
	return ACTION_LABEL[action] ?? action;
}

export function actionFill(action: string): string {
	return ACTION_FILL[action] ?? 'bg-palace-500';
}

export function actionChip(action: string): string {
	return ACTION_CHIP[action] ?? 'bg-palace-500 text-white';
}
