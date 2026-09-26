import {
	hasMonth,
	type Month,
	monthAbbr,
	monthName,
	monthsInOrder,
} from '@/lib/schedule/months';
import { actionFill } from '@/lib/ui/actions';

/**
 * A window as twelve little boxes.
 *
 * Takes a month mask, which is how the schedule actually stores a window, so
 * nothing has to build a throwaway rule object to draw one. This replaces two
 * independent implementations - RuleStrip and a local copy inside
 * ProposalReview - that had drifted apart.
 */
export function MonthStrip({
	action,
	monthMask,
	startMonth = 7,
	currentMonth,
	labelled = false,
}: {
	action: string;
	monthMask: number;
	startMonth?: Month;
	currentMonth?: Month;
	/** Adds the row of month letters above the boxes. */
	labelled?: boolean;
}) {
	const months = monthsInOrder(startMonth);
	const fill = actionFill(action);

	return (
		<div className="inline-block">
			{labelled && (
				<div className="flex gap-px pb-0.5">
					{months.map((m) => (
						<abbr
							key={m}
							title={monthName(m)}
							className="w-5 text-center text-2xs text-ink-soft no-underline"
						>
							{monthAbbr(m).slice(0, 1)}
						</abbr>
					))}
				</div>
			)}
			<div className="flex gap-px">
				{months.map((m) => {
					const on = hasMonth(monthMask, m);
					return (
						<span
							key={m}
							title={monthName(m)}
							className={`h-5 w-5 rounded-sm ${
								on ? fill : m === currentMonth ? 'bg-palace-100' : 'bg-paper-sunk'
							} ${m === currentMonth ? 'ring-1 ring-palace-500' : ''}`}
						>
							<span className="sr-only">
								{monthName(m)}: {on ? action : 'nothing'}
							</span>
						</span>
					);
				})}
			</div>
		</div>
	);
}
