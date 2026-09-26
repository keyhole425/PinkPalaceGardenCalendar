import Link from 'next/link';
import { MonthGrid } from '@/components/grid/MonthGrid';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { monthOf, today } from '@/lib/dates';
import { getGrid, getGridMarks } from '@/lib/db/queries/grid';
import { type Month, monthName } from '@/lib/schedule/months';
import { cx } from '@/lib/ui/cx';

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
	const marks = getGridMarks(today());

	return (
		<Frame width="wide">
			<PageHeader
				title="The year"
				description={
					<>
						Every plant, every month. Cells marked <em>or</em> are alternatives
						&mdash; do one of them, not all. A tick is work recorded in the last
						year. Today is {monthName(currentMonth)}.
					</>
				}
				actions={
					<div className="flex items-center gap-1 text-sm">
						<span className="text-ink-soft">Start in</span>
						<StartToggle active={startMonth === 7} href="/grid" label="July" />
						<StartToggle
							active={startMonth === 1}
							href="/grid?start=1"
							label="January"
						/>
					</div>
				}
			/>

			<MonthGrid
				plants={plants}
				startMonth={startMonth}
				currentMonth={currentMonth}
				marks={marks}
			/>

			<p className="mt-3 text-ink-soft text-xs">
				Seeded from <code className="font-mono">ORCHARD SCHEDULE.numbers</code>.
				Plants marked <em>needs review</em> have gaps the spreadsheet never filled
				in.
			</p>
		</Frame>
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
			aria-current={active ? 'true' : undefined}
			className={cx(
				'rounded-full px-3 py-1',
				active
					? 'bg-palace-200 font-medium text-palace-700'
					: 'text-ink-soft hover:bg-palace-50',
			)}
		>
			{label}
		</Link>
	);
}
