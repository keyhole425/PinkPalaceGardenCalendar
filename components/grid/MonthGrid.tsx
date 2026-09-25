import Link from 'next/link';
import type {
	CellMark,
	GridAction,
	GridPlant,
	GridRule,
} from '@/lib/db/queries/grid';
import { cellKey } from '@/lib/db/queries/grid';
import {
	hasMonth,
	isRunStart,
	type Month,
	monthAbbr,
	monthName,
	monthsInOrder,
} from '@/lib/schedule/months';

const ACTION_LABEL: Record<GridAction, string> = {
	fertilise: 'Fertilise',
	prune: 'Prune',
	harvest: 'Harvest',
};

/**
 * Tailwind can't build class names at runtime, so the variants are spelled out.
 */
const ACTION_CHIP: Record<GridAction, string> = {
	fertilise: 'bg-fertilise text-white',
	prune: 'bg-prune text-white',
	harvest: 'bg-harvest text-white',
};

const ACTION_CELL: Record<GridAction, string> = {
	fertilise: 'bg-fertilise',
	prune: 'bg-prune',
	harvest: 'bg-harvest',
};

/** A full tick when every plant of the type is done, a hollow one otherwise. */
function tick(mark: CellMark): string {
	return mark.done >= mark.total ? '\u2713' : `\u2713${mark.done}/${mark.total}`;
}

type CellState = {
	filled: boolean;
	/** True when this month is one of several alternatives, only one needed. */
	alternative: boolean;
	note: string | null;
	/** First month of its run, so a wide window only gets labelled once. */
	runStart: boolean;
};

function cellState(rules: GridRule[], month: Month): CellState {
	const covering = rules.filter((r) => hasMonth(r.monthMask, month));
	if (covering.length === 0) {
		return { filled: false, alternative: false, note: null, runStart: false };
	}
	return {
		filled: true,
		alternative: covering.some((r) => r.altGroup !== null),
		note: covering.find((r) => r.note)?.note ?? null,
		runStart: covering.some((r) => isRunStart(r.monthMask, month)),
	};
}

export function MonthGrid({
	plants,
	startMonth,
	currentMonth,
	marks,
}: {
	plants: GridPlant[];
	startMonth: Month;
	currentMonth: Month;
	/** Completions from the last twelve months, keyed by plant, action, month. */
	marks: Map<string, CellMark>;
}) {
	const months = monthsInOrder(startMonth);

	return (
		<div className="max-h-[calc(100dvh-11rem)] overflow-auto border border-rule-strong">
			<table className="w-max border-collapse text-sm">
				<thead>
					<tr>
						<th
							scope="col"
							className="sticky top-0 left-0 z-40 w-28 min-w-28 border-rule border-r border-b bg-paper-sunk px-2 py-2 text-left font-semibold sm:w-64 sm:min-w-64 sm:px-3"
						>
							Plant
						</th>
						<th
							scope="col"
							className="sticky top-0 left-28 z-40 w-20 min-w-20 border-rule border-r border-b bg-paper-sunk px-1 py-2 text-left font-semibold sm:left-64 sm:w-24 sm:min-w-24 sm:px-2"
						>
							Action
						</th>
						{months.map((m) => (
							<th
								key={m}
								scope="col"
								className={`sticky top-0 z-30 w-12 min-w-12 border-rule border-r border-b px-1 py-2 text-center font-semibold sm:w-16 sm:min-w-16 ${
									m === currentMonth
										? 'bg-palace-200 text-palace-700'
										: 'bg-paper-sunk text-ink-soft'
								}`}
							>
								<abbr title={monthName(m)} className="no-underline">
									{monthAbbr(m)}
								</abbr>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{plants.map((plant) =>
						plant.rows.map((row, rowIndex) => (
							<tr key={`${plant.id}-${row.action}`}>
								{rowIndex === 0 && (
									<th
										scope="rowgroup"
										rowSpan={plant.rows.length}
										className="sticky left-0 z-20 border-rule border-r border-b bg-paper-sunk px-2 py-2 text-left align-top font-normal sm:px-3"
									>
										<Link
											href={`/plants/${plant.slug}`}
											className="font-semibold text-ink hover:text-palace-700"
										>
											{plant.commonName}
										</Link>
										{plant.needsReview && (
											<span
												className="mt-1 inline-block rounded-full bg-palace-200 px-2 py-0.5 text-palace-700 text-xs sm:mt-0 sm:ml-2"
												title="figgy does not know this plant's full schedule yet"
											>
												needs review
											</span>
										)}
										{plant.notesMd && (
											<p className="mt-1 hidden whitespace-pre-line text-ink-soft text-xs leading-snug sm:block">
												{plant.notesMd}
											</p>
										)}
									</th>
								)}
								<td className="sticky left-28 z-10 border-rule border-r border-b bg-paper p-1 sm:left-64">
									<span
										className={`block rounded-sm px-2 py-1 font-medium text-xs ${ACTION_CHIP[row.action]}`}
									>
										{ACTION_LABEL[row.action]}
									</span>
								</td>
								{months.map((m) => {
									const state = cellState(row.rules, m);
									const isNow = m === currentMonth;
									const mark = marks.get(cellKey(plant.id, row.action, m));
									return (
										<td
											key={m}
											className={`h-9 border-rule border-r border-b p-0.5 ${
												isNow && !state.filled && !mark ? 'bg-palace-50' : ''
											}`}
										>
											{state.filled && (
												<div
													className={`flex h-full items-center justify-center rounded-sm text-[10px] text-white uppercase tracking-wide ${ACTION_CELL[row.action]}`}
													title={
														state.note ??
														`${ACTION_LABEL[row.action]} - ${monthName(m)}`
													}
												>
													{mark ? tick(mark) : state.alternative ? 'or' : ''}
												</div>
											)}
											{!state.filled && mark && (
												// Work done outside the written window still counts,
												// and is worth seeing where it actually happened.
												<div
													className="flex h-full items-center justify-center rounded-sm border border-rule text-ink-soft text-[10px]"
													title={`${ACTION_LABEL[row.action]} recorded in ${monthName(m)}, outside the usual window`}
												>
													{tick(mark)}
												</div>
											)}
											<span className="sr-only">
												{state.filled
													? `${ACTION_LABEL[row.action]} ${plant.commonName} in ${monthName(m)}${
															state.alternative ? ' (one of several options)' : ''
														}`
													: ''}
											</span>
										</td>
									);
								})}
							</tr>
						)),
					)}
				</tbody>
			</table>
		</div>
	);
}
