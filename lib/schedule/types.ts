import type { IsoDate } from '@/lib/dates';
import type { Cadence, CareAction } from '@/lib/db/schema';

/** The minimum a rule has to look like for the engine to work with it. */
export type RuleInput = {
	id: number;
	action: CareAction;
	monthMask: number;
	cadence: Cadence;
	altGroup: string | null;
	environmentKind: string | null;
	note: string | null;
	/** Set on a rule that belongs to one plant rather than to the whole type. */
	plantingId: number | null;
};

export type EnvironmentInput = {
	id: number;
	kind: string;
	name: string;
	frostFree: boolean;
	windowShiftMonths: number;
};

/**
 * What a planting actually needs, after overrides, environment scoping and any
 * seasonal shift have been applied. Alternatives are folded into one rule: if
 * you may prune in August or September, that is one job with a two-month
 * window, not two jobs.
 */
export type EffectiveRule = {
	/** The representative rule; the one a completion is logged against. */
	id: number;
	/** Every underlying rule, including the other options of an alternative. */
	ruleIds: number[];
	action: CareAction;
	/** The window as it applies here, after any environment shift. */
	monthMask: number;
	/** The window as written on the rule, before shifting. */
	sourceMask: number;
	cadence: Cadence;
	altGroup: string | null;
	note: string | null;
	/** True when the environment moved this window off its written months. */
	shifted: boolean;
	/** True when this came from a rule written for this one plant. */
	isOverride: boolean;
};

export type OccurrenceState = 'done' | 'due' | 'overdue' | 'upcoming' | 'future';

/** One concrete instance of a rule: this window, this year. */
export type Occurrence = {
	rule: EffectiveRule;
	opensOn: IsoDate;
	closesOn: IsoDate;
	/** The year the window opened; a Nov-Feb window belongs to the earlier year. */
	seasonYear: number;
	/** Stable identity for the occurrence, stored against a completion. */
	key: string;
	state: OccurrenceState;
	completedOn: IsoDate | null;
	logId: number | null;
};

export type LogInput = {
	id: number;
	careRuleId: number | null;
	occurrenceKey: string | null;
	completedOn: IsoDate;
};
