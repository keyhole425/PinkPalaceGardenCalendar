import Link from 'next/link';
import { daysBetween, formatLong, type IsoDate, monthOf } from '@/lib/dates';
import type { Task } from '@/lib/db/queries/garden';
import type { CareAction } from '@/lib/db/schema';
import { maskRuns, monthAbbr } from '@/lib/schedule/months';

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
};

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
};

export function ActionChip({ action }: { action: CareAction | string }) {
	return (
		<span
			className={`inline-block shrink-0 rounded-sm px-2 py-1 font-medium text-xs ${
				ACTION_CHIP[action] ?? 'bg-palace-500 text-white'
			}`}
		>
			{ACTION_LABEL[action] ?? action}
		</span>
	);
}

/** "closes in 9 days", "closed 3 days ago", "opens in a fortnight". */
function relativeDays(from: IsoDate, to: IsoDate, verb: string): string {
	const days = daysBetween(from, to);
	if (days === 0) return `${verb} today`;
	if (days === 1) return `${verb} tomorrow`;
	if (days === -1) return `${verb} yesterday`;
	return days > 0
		? `${verb} in ${days} days`
		: `${verb} ${Math.abs(days)} days ago`;
}

/**
 * The months this particular window covers - not the months the rule names.
 * A rule that says "January, March, September and November" produces four
 * separate jobs, and the card for the September one should say September.
 */
function windowSummary(opensOn: IsoDate, closesOn: IsoDate): string {
	const from = monthOf(opensOn);
	const to = monthOf(closesOn);
	return from === to ? monthAbbr(from) : `${monthAbbr(from)}–${monthAbbr(to)}`;
}

/** The whole shape of a rule, for explaining a window the environment moved. */
function ruleSummary(monthMask: number): string {
	return maskRuns(monthMask)
		.map((run) =>
			run.start === run.end
				? monthAbbr(run.start)
				: `${monthAbbr(run.start)}–${monthAbbr(run.end)}`,
		)
		.join(', ');
}

export function TaskCard({ task, today }: { task: Task; today: IsoDate }) {
	const { occurrence, context } = task;
	const alternatives = occurrence.rule.ruleIds.length > 1;

	const timing =
		occurrence.state === 'overdue'
			? relativeDays(today, occurrence.closesOn, 'window closed')
			: occurrence.state === 'due'
				? relativeDays(today, occurrence.closesOn, 'closes')
				: occurrence.state === 'done'
					? `done ${formatLong(occurrence.completedOn ?? today)}`
					: relativeDays(today, occurrence.opensOn, 'opens');

	return (
		<li
			className={`flex items-start gap-3 rounded-md border p-3 ${
				occurrence.state === 'overdue'
					? 'border-prune/40 bg-prune-soft/50'
					: 'border-rule bg-paper'
			}`}
		>
			<ActionChip action={occurrence.rule.action} />
			<div className="min-w-0 flex-1">
				<p className="font-medium">
					<Link
						href={`/plants/${context.plantSlug}`}
						className="hover:text-palace-700"
					>
						{context.label}
					</Link>
					{context.environment.kind !== 'orchard' && (
						<span className="ml-2 text-ink-soft text-xs">
							{context.environment.name}
						</span>
					)}
				</p>
				<p className="text-ink-soft text-sm">
					{windowSummary(occurrence.opensOn, occurrence.closesOn)} &middot; {timing}
					{alternatives && (
						<span
							className="ml-2 rounded-full bg-palace-100 px-2 py-0.5 text-palace-700 text-xs"
							title="Any one month in this window will do"
						>
							one of {occurrence.rule.ruleIds.length}
						</span>
					)}
					{occurrence.rule.shifted && (
						<span
							className="ml-2 rounded-full bg-palace-100 px-2 py-0.5 text-palace-700 text-xs"
							title={`Shifted from ${ruleSummary(occurrence.rule.sourceMask)} because of where this is growing`}
						>
							shifted
						</span>
					)}
				</p>
				{occurrence.rule.note && (
					<p className="mt-1 text-ink-soft text-xs">{occurrence.rule.note}</p>
				)}
			</div>
		</li>
	);
}
