import Link from 'next/link';
import type { CellMark, GridPlant, GridRule } from '@/lib/db/queries/grid';
import { cellKey } from '@/lib/db/queries/grid';
import {
	hasMonth,
	isRunStart,
	type Month,
	monthAbbr,
	monthName,
	monthsInOrder,
} from '@/lib/schedule/months';
import { actionChip, actionFill, actionLabel } from '@/lib/ui/actions';

/**
 * A full tick when every plant of the type is done, a hollow one otherwise.
 *
 * A phone's cell is about 20px wide and "✓2/3" is 26px, so there the partial
 * tick is just the fraction. The cell's title and screen-reader text still
 * say it in full.
 */
function tick(mark: CellMark, compact: boolean): string {
	if (mark.done >= mark.total) return '✓';
	return compact ? `${mark.done}/${mark.total}` : `✓${mark.done}/${mark.total}`;
}

function doneText(mark: CellMark): string {
	return mark.done >= mark.total
		? 'done in the last year'
		: `${mark.done} of ${mark.total} done in the last year`;
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

type GridProps = {
	plants: GridPlant[];
	startMonth: Month;
	currentMonth: Month;
	/** Completions from the last twelve months, keyed by plant, action, month. */
	marks: Map<string, CellMark>;
};

/**
 * The year as a table: a row per plant per action, a column per month.
 *
 * Two tables from the same data. On a phone the plant column and the action
 * column together took 192px of 333px, which left room for under three
 * months; truncating the plant names would have bought less than one more.
 * So below `sm` the plant is a heading row of its own and the twelve months
 * share the width - the whole year on one screen, the way the spreadsheet
 * was. The rows are shaped differently (a rowSpan column against a heading
 * row), so CSS alone cannot turn one into the other.
 */
export function MonthGrid(props: GridProps) {
	return (
		<>
			<WideGrid {...props} />
			<PhoneGrid {...props} />
		</>
	);
}

function WideGrid({ plants, startMonth, currentMonth, marks }: GridProps) {
	const months = monthsInOrder(startMonth);

	return (
		<div className="hidden max-h-[calc(100dvh-13rem)] overflow-auto border border-rule-strong sm:block">
			<table className="w-max border-collapse text-sm">
				<thead>
					<tr>
						<th
							scope="col"
							className="sticky top-0 left-0 z-40 w-64 min-w-64 border-rule border-r border-b bg-paper-sunk px-3 py-2 text-left font-semibold"
						>
							Plant
						</th>
						<th
							scope="col"
							className="sticky top-0 left-64 z-40 w-24 min-w-24 border-rule border-r border-b bg-paper-sunk px-2 py-2 text-left font-semibold"
						>
							Action
						</th>
						{months.map((m) => (
							<th
								key={m}
								scope="col"
								className={`sticky top-0 z-30 w-16 min-w-16 border-rule border-r border-b px-1 py-2 text-center font-semibold ${
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
										className="sticky left-0 z-20 border-rule border-r border-b bg-paper-sunk px-3 py-2 text-left align-top font-normal"
									>
										<Link
											href={`/plants/${plant.slug}`}
											className="font-semibold text-ink hover:text-palace-700"
										>
											{plant.commonName}
										</Link>
										{plant.needsReview && <NeedsReview className="ml-2" />}
										{plant.noteSummary && (
											<p
												title={plant.notesMd ?? undefined}
												className="mt-1 line-clamp-2 max-w-64 text-ink-soft text-2xs leading-snug"
											>
												{plant.noteSummary}
											</p>
										)}
									</th>
								)}
								<td className="sticky left-64 z-10 border-rule border-r border-b bg-paper p-1">
									<span
										className={`block rounded-sm px-2 py-1 font-medium text-xs ${actionChip(row.action)}`}
									>
										{actionLabel(row.action)}
									</span>
								</td>
								{months.map((m) => (
									<MonthCell
										key={m}
										plant={plant}
										action={row.action}
										rules={row.rules}
										month={m}
										isNow={m === currentMonth}
										mark={marks.get(cellKey(plant.id, row.action, m))}
									/>
								))}
							</tr>
						)),
					)}
				</tbody>
			</table>
		</div>
	);
}

/**
 * The phone's year: twelve columns of about 20px, the size of the boxes in a
 * plant page's MonthStrip, with one letter per month heading them.
 */
function PhoneGrid({ plants, startMonth, currentMonth, marks }: GridProps) {
	const months = monthsInOrder(startMonth);

	return (
		<div className="max-h-[calc(100dvh-13rem)] overflow-auto border border-rule-strong sm:hidden">
			<table className="w-full table-fixed border-collapse text-sm">
				<colgroup>
					<col className="w-16" />
					{months.map((m) => (
						<col key={m} />
					))}
				</colgroup>
				<thead>
					<tr>
						<th
							scope="col"
							className="sticky top-0 z-10 border-rule border-r border-b bg-paper-sunk"
						>
							<span className="sr-only">Action</span>
						</th>
						{months.map((m) => (
							<th
								key={m}
								scope="col"
								className={`sticky top-0 z-10 border-rule border-r border-b py-2 text-center font-semibold text-xs ${
									m === currentMonth
										? 'bg-palace-200 text-palace-700'
										: 'bg-paper-sunk text-ink-soft'
								}`}
							>
								<abbr title={monthName(m)} className="no-underline">
									{monthAbbr(m).slice(0, 1)}
								</abbr>
							</th>
						))}
					</tr>
				</thead>
				{plants.map((plant) => (
					<tbody key={plant.id}>
						<tr>
							<th
								scope="rowgroup"
								colSpan={months.length + 1}
								className="border-rule border-b bg-paper-sunk px-2 text-left font-normal"
							>
								<div className="flex flex-wrap items-center gap-x-2">
									<Link
										href={`/plants/${plant.slug}`}
										className="inline-flex min-h-tap items-center font-semibold text-ink hover:text-palace-700"
									>
										{plant.commonName}
									</Link>
									{plant.needsReview && <NeedsReview />}
								</div>
							</th>
						</tr>
						{plant.rows.map((row) => (
							<tr key={row.action}>
								<td className="border-rule border-r border-b bg-paper px-0.5 py-0.5">
									<span
										className={`block truncate rounded-sm px-1.5 py-1 font-medium text-xs ${actionChip(row.action)}`}
									>
										{actionLabel(row.action)}
									</span>
								</td>
								{months.map((m) => (
									<MonthCell
										key={m}
										compact
										plant={plant}
										action={row.action}
										rules={row.rules}
										month={m}
										isNow={m === currentMonth}
										mark={marks.get(cellKey(plant.id, row.action, m))}
									/>
								))}
							</tr>
						))}
					</tbody>
				))}
			</table>
		</div>
	);
}

function NeedsReview({ className = '' }: { className?: string }) {
	return (
		<span
			className={`inline-block rounded-full bg-palace-200 px-2 py-0.5 text-palace-700 text-xs ${className}`}
			title="figgy does not know this plant's full schedule yet"
		>
			needs review
		</span>
	);
}

/** One month of one action, shared by both tables so they cannot drift. */
function MonthCell({
	plant,
	action,
	rules,
	month,
	isNow,
	mark,
	compact = false,
}: {
	plant: GridPlant;
	action: string;
	rules: GridRule[];
	month: Month;
	isNow: boolean;
	mark: CellMark | undefined;
	compact?: boolean;
}) {
	const state = cellState(rules, month);
	const label = actionLabel(action);

	return (
		<td
			className={`border-rule border-r border-b p-0.5 ${compact ? 'h-7' : 'h-9'} ${
				isNow && !state.filled && !mark ? 'bg-palace-50' : ''
			}`}
		>
			{state.filled && (
				<div
					className={`flex h-full items-center justify-center rounded-sm text-2xs text-ink tabular-nums ${actionFill(action)}`}
					title={state.note ?? `${label} - ${monthName(month)}`}
				>
					{mark ? tick(mark, compact) : state.alternative ? 'or' : ''}
				</div>
			)}
			{!state.filled && mark && (
				// Work done outside the written window still counts,
				// and is worth seeing where it actually happened.
				<div
					className="flex h-full items-center justify-center rounded-sm border border-rule text-ink-soft text-2xs tabular-nums"
					title={`${label} recorded in ${monthName(month)}, outside the usual window`}
				>
					{tick(mark, compact)}
				</div>
			)}
			<span className="sr-only">
				{state.filled
					? `${label} ${plant.commonName} in ${monthName(month)}${
							state.alternative ? ' (one of several options)' : ''
						}${mark ? `, ${doneText(mark)}` : ''}`
					: mark
						? `${label} ${plant.commonName} recorded in ${monthName(month)}, outside the usual window, ${doneText(mark)}`
						: ''}
			</span>
		</td>
	);
}
