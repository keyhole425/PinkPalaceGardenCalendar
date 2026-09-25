import Link from 'next/link';
import { MonthGrid } from '@/components/grid/MonthGrid';
import { monthOf, today } from '@/lib/dates';
import { getGrid } from '@/lib/db/queries/grid';
import { type Month, monthName } from '@/lib/schedule/months';

export const dynamic = 'force-dynamic';

/**
 * July by default. A southern-hemisphere orchard year reads better starting in
 * winter: dormancy, then spring, then the harvest at the far end. The original
 * spreadsheet ran January to December, so that view is one click away.
 */
const DEFAULT_START: Month = 7;

export default async function GridPage({
	searchParams,
}: {
	searchParams: Promise<{ start?: string }>;
}) {
	const { start } = await searchParams;
	const startMonth: Month = start === '1' ? 1 : DEFAULT_START;
	const currentMonth = monthOf(today());
	const plants = getGrid();

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<div>
					<h1 className="font-semibold text-2xl">The year</h1>
					<p className="text-ink-soft text-sm">
						Every plant, every month. Cells marked <em>or</em> are alternatives
						&mdash; do one of them, not all. Today is {monthName(currentMonth)}.
					</p>
				</div>
				<div className="flex items-center gap-1 text-sm">
					<span className="text-ink-soft">Start the year in</span>
					<StartToggle active={startMonth === 7} href="/grid" label="July" />
					<StartToggle
						active={startMonth === 1}
						href="/grid?start=1"
						label="January"
					/>
				</div>
			</div>

			<MonthGrid
				plants={plants}
				startMonth={startMonth}
				currentMonth={currentMonth}
			/>

			<p className="text-ink-soft text-xs">
				Seeded from <code>ORCHARD SCHEDULE.numbers</code>. Plants marked{' '}
				<em>needs review</em> have gaps the spreadsheet never filled in.
			</p>
		</div>
	);
}

function StartToggle({
	active,
	href,
	label,
}: {
	active: boolean;
	href: string;
	label: string;
}) {
	return (
		<Link
			href={href}
			className={`rounded-full px-3 py-1 ${
				active
					? 'bg-palace-200 font-medium text-palace-700'
					: 'text-ink-soft hover:bg-palace-50'
			}`}
		>
			{label}
		</Link>
	);
}
