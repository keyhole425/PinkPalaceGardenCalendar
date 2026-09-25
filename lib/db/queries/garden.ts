/**
 * Loading the garden and running the schedule over it.
 *
 * Everything is read in three flat queries and joined in memory. At a few
 * dozen plantings that is faster than the joins would be, and it keeps the
 * engine working on plain data it can be tested against.
 */
import { asc, eq, ne } from 'drizzle-orm';
import type { IsoDate } from '@/lib/dates';
import { today as todayInGarden } from '@/lib/dates';
import { expandOccurrences, openSeasons } from '@/lib/schedule/expand';
import { resolveRules } from '@/lib/schedule/rules';
import type {
	EffectiveRule,
	EnvironmentInput,
	LogInput,
	Occurrence,
	RuleInput,
} from '@/lib/schedule/types';
import { db } from '../client';
import { careLog, careRule, environment, planting, plantType } from '../schema';

export type PlantingContext = {
	plantingId: number;
	label: string;
	plantTypeId: number;
	plantSlug: string;
	plantName: string;
	environment: EnvironmentInput;
};

export type Task = {
	occurrence: Occurrence;
	context: PlantingContext;
};

export type HarvestSeason = {
	context: PlantingContext;
	rule: EffectiveRule;
	opensOn: IsoDate;
	closesOn: IsoDate;
};

function loadPlantings() {
	return (
		db
			.select({
				plantingId: planting.id,
				label: planting.label,
				plantTypeId: planting.plantTypeId,
				plantSlug: plantType.slug,
				plantName: plantType.commonName,
				environmentId: environment.id,
				environmentKind: environment.kind,
				environmentName: environment.name,
				frostFree: environment.frostFree,
				windowShiftMonths: environment.windowShiftMonths,
			})
			.from(planting)
			.innerJoin(plantType, eq(planting.plantTypeId, plantType.id))
			.innerJoin(environment, eq(planting.environmentId, environment.id))
			// A tree that has been pulled out needs nothing.
			.where(ne(planting.status, 'removed'))
			.orderBy(asc(plantType.id), asc(planting.id))
			.all()
	);
}

function toContext(row: ReturnType<typeof loadPlantings>[number]): PlantingContext {
	return {
		plantingId: row.plantingId,
		label: row.label,
		plantTypeId: row.plantTypeId,
		plantSlug: row.plantSlug,
		plantName: row.plantName,
		environment: {
			id: row.environmentId,
			kind: row.environmentKind,
			name: row.environmentName,
			frostFree: row.frostFree,
			windowShiftMonths: row.windowShiftMonths,
		},
	};
}

function loadRules(): RuleInput[] {
	return db
		.select({
			id: careRule.id,
			plantTypeId: careRule.plantTypeId,
			plantingId: careRule.plantingId,
			action: careRule.action,
			monthMask: careRule.monthMask,
			cadence: careRule.cadence,
			altGroup: careRule.altGroup,
			environmentKind: careRule.environmentKind,
			note: careRule.note,
		})
		.from(careRule)
		.where(eq(careRule.active, true))
		.orderBy(asc(careRule.id))
		.all() as (RuleInput & { plantTypeId: number | null })[];
}

function loadLogs(): (LogInput & { plantingId: number })[] {
	return db
		.select({
			id: careLog.id,
			plantingId: careLog.plantingId,
			careRuleId: careLog.careRuleId,
			occurrenceKey: careLog.occurrenceKey,
			completedOn: careLog.completedOn,
		})
		.from(careLog)
		.all();
}

export type PlantingSchedule = {
	context: PlantingContext;
	/** Everything this plant needs, including continuous harvest windows. */
	rules: EffectiveRule[];
	occurrences: Occurrence[];
};

export type GardenSchedule = {
	today: IsoDate;
	plantings: PlantingSchedule[];
	/** The same occurrences, flattened, for the dashboard. */
	tasks: Task[];
	harvesting: HarvestSeason[];
};

/** Every job in the garden, in whatever state it is in. */
export function getSchedule(when: IsoDate = todayInGarden()): GardenSchedule {
	const rows = loadPlantings();
	const allRules = loadRules() as (RuleInput & { plantTypeId: number | null })[];
	const allLogs = loadLogs();

	const plantings: PlantingSchedule[] = [];
	const tasks: Task[] = [];
	const harvesting: HarvestSeason[] = [];

	for (const row of rows) {
		const context = toContext(row);

		const applicable = allRules.filter(
			(r) =>
				r.plantTypeId === context.plantTypeId ||
				r.plantingId === context.plantingId,
		);
		const rules = resolveRules(applicable, context.environment, context.plantingId);
		const logs = allLogs.filter((l) => l.plantingId === context.plantingId);
		const occurrences = expandOccurrences(rules, logs, { today: when });

		plantings.push({ context, rules, occurrences });
		for (const occurrence of occurrences) {
			tasks.push({ occurrence, context });
		}
		for (const season of openSeasons(rules, when)) {
			harvesting.push({ context, ...season });
		}
	}

	return { today: when, plantings, tasks, harvesting };
}

/**
 * Finds one occurrence by the identity a page hands back.
 *
 * Completions are written against this rather than against whatever a form
 * says: the engine decides which action and which season a job belongs to, so
 * a stale page cannot invent a job that does not exist.
 */
export function findOccurrence(
	plantingId: number,
	ruleId: number,
	occurrenceKey: string,
	when: IsoDate = todayInGarden(),
): Task | null {
	const { plantings } = getSchedule(when);
	const entry = plantings.find((p) => p.context.plantingId === plantingId);
	if (!entry) return null;

	const occurrence = entry.occurrences.find(
		(o) => o.rule.ruleIds.includes(ruleId) && o.key === occurrenceKey,
	);
	return occurrence ? { occurrence, context: entry.context } : null;
}

/** The harvest seasons open for one plant right now. */
export function openSeasonsFor(
	plantingId: number,
	when: IsoDate = todayInGarden(),
): HarvestSeason[] {
	return getSchedule(when).harvesting.filter(
		(h) => h.context.plantingId === plantingId,
	);
}

/** How far back a missed job keeps nagging before it becomes history. */
export const OVERDUE_LOOKBACK_DAYS = 90;
/** How far back the "recently done" list reaches. */
export const RECENT_DONE_DAYS = 30;

export type Dashboard = {
	today: IsoDate;
	overdue: Task[];
	due: Task[];
	upcoming: Task[];
	harvesting: HarvestSeason[];
	recentlyDone: Task[];
};

export function getDashboard(when: IsoDate = todayInGarden()): Dashboard {
	const { tasks, harvesting } = getSchedule(when);
	const overdueFloor = shiftIso(when, -OVERDUE_LOOKBACK_DAYS);
	const doneFloor = shiftIso(when, -RECENT_DONE_DAYS);

	return {
		today: when,
		// Missing a job by a year is history, not a to-do list. Only recent
		// misses are worth showing; the rest live on the plant's own page.
		overdue: tasks
			.filter((t) => t.occurrence.state === 'overdue')
			.filter((t) => t.occurrence.closesOn >= overdueFloor)
			.sort((a, b) => b.occurrence.closesOn.localeCompare(a.occurrence.closesOn)),
		// Closing soonest first: that is the one you might still miss.
		due: tasks
			.filter((t) => t.occurrence.state === 'due')
			.sort((a, b) => a.occurrence.closesOn.localeCompare(b.occurrence.closesOn)),
		upcoming: tasks
			.filter((t) => t.occurrence.state === 'upcoming')
			.sort((a, b) => a.occurrence.opensOn.localeCompare(b.occurrence.opensOn)),
		harvesting: harvesting.sort((a, b) =>
			a.context.plantName.localeCompare(b.context.plantName),
		),
		recentlyDone: tasks
			.filter((t) => t.occurrence.state === 'done')
			.filter((t) => (t.occurrence.completedOn ?? '') >= doneFloor)
			.sort((a, b) =>
				(b.occurrence.completedOn ?? '').localeCompare(
					a.occurrence.completedOn ?? '',
				),
			),
	};
}

function shiftIso(date: IsoDate, days: number): IsoDate {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}
