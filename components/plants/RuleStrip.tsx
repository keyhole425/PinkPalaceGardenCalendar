import {
	hasMonth,
	type Month,
	monthName,
	monthsInOrder,
} from '@/lib/schedule/months';
import type { EffectiveRule } from '@/lib/schedule/types';

const FILL: Record<string, string> = {
	fertilise: 'bg-fertilise',
	prune: 'bg-prune',
	harvest: 'bg-harvest',
	sow: 'bg-fertilise',
	transplant: 'bg-fertilise',
	thin: 'bg-prune',
};

/** A single rule's window, as twelve little boxes. */
export function RuleStrip({
	rule,
	startMonth = 7,
	currentMonth,
}: {
	rule: EffectiveRule;
	startMonth?: Month;
	currentMonth?: Month;
}) {
	return (
		<div className="flex gap-px">
			{monthsInOrder(startMonth).map((m) => {
				const on = hasMonth(rule.monthMask, m);
				return (
					<span
						key={m}
						title={monthName(m)}
						className={`h-5 w-5 rounded-[2px] ${
							on
								? (FILL[rule.action] ?? 'bg-palace-500')
								: m === currentMonth
									? 'bg-palace-100'
									: 'bg-paper-sunk'
						} ${m === currentMonth ? 'ring-1 ring-palace-500' : ''}`}
					>
						<span className="sr-only">
							{monthName(m)}: {on ? rule.action : 'nothing'}
						</span>
					</span>
				);
			})}
		</div>
	);
}
