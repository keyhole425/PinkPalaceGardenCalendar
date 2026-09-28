import Link from 'next/link';
import { ActionChip } from '@/components/ui/ActionChip';
import { Badge } from '@/components/ui/Badge';
import { daysBetween, formatLong, type IsoDate, monthOf } from '@/lib/dates';
import type { Task } from '@/lib/db/queries/garden';
import { maskRuns, monthAbbr } from '@/lib/schedule/months';
import { DoneForm, UndoButton } from './DoneForm';

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

export function TaskCard({
	task,
	today,
	actionable = true,
}: {
	task: Task;
	today: IsoDate;
	/** Off where a card is history rather than a to-do. */
	actionable?: boolean;
}) {
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
			className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 rounded-md border px-3 py-2 ${
				occurrence.state === 'overdue'
					? 'border-prune bg-prune-soft/50'
					: 'border-rule bg-paper'
			}`}
		>
			<ActionChip action={occurrence.rule.action} />
			<div className="min-w-0">
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
						<Badge className="ml-2" title="Any one month in this window will do">
							one of {occurrence.rule.ruleIds.length}
						</Badge>
					)}
					{occurrence.rule.shifted && (
						<Badge
							className="ml-2"
							title={`Shifted from ${ruleSummary(occurrence.rule.sourceMask)} because of where this is growing`}
						>
							shifted
						</Badge>
					)}
				</p>
				{occurrence.rule.note && (
					// Two lines, like the year grid. Some of these run to a
					// paragraph - Plum's pruning notes make a card half again as
					// tall as its neighbours - and a board of jobs wants every row
					// the same height. The whole note is on hover and on the plant.
					<p
						title={occurrence.rule.note}
						className="mt-1 line-clamp-2 text-ink-soft text-xs"
					>
						{occurrence.rule.note}
					</p>
				)}
			</div>

			<div className="w-24 shrink-0 text-right">
				{actionable && occurrence.state !== 'done' && (
					<DoneForm
						plantingId={context.plantingId}
						ruleId={occurrence.rule.id}
						occurrenceKey={occurrence.key}
						today={today}
					/>
				)}
				{occurrence.state === 'done' && occurrence.logId !== null && (
					<UndoButton logId={occurrence.logId} slug={context.plantSlug} />
				)}
			</div>
		</li>
	);
}
