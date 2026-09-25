import Link from 'next/link';
import { Section } from '@/components/tasks/Section';
import { ActionChip, TaskCard } from '@/components/tasks/TaskCard';
import { formatLong, monthOf, today } from '@/lib/dates';
import { getDashboard } from '@/lib/db/queries/garden';
import { monthName } from '@/lib/schedule/months';

export const dynamic = 'force-dynamic';

export default async function NowPage() {
	const when = today();
	const board = getDashboard(when);

	return (
		<div className="space-y-6">
			<header>
				<h1 className="font-semibold text-2xl">What&rsquo;s on</h1>
				<p className="text-ink-soft text-sm">
					{formatLong(when)} &middot; {monthName(monthOf(when))} in the garden
				</p>
			</header>

			<Section
				title="Overdue"
				count={board.overdue.length}
				tone="alert"
				empty="Nothing missed in the last three months."
			>
				{board.overdue.map((task) => (
					<TaskCard
						key={`${task.context.plantingId}-${task.occurrence.rule.id}-${task.occurrence.key}`}
						task={task}
						today={when}
					/>
				))}
			</Section>

			<Section
				title="Due now"
				count={board.due.length}
				empty="Nothing needs doing today."
			>
				{board.due.map((task) => (
					<TaskCard
						key={`${task.context.plantingId}-${task.occurrence.rule.id}-${task.occurrence.key}`}
						task={task}
						today={when}
					/>
				))}
			</Section>

			<section className="space-y-2">
				<h2 className="flex items-baseline gap-2 font-semibold text-lg">
					Harvesting now
					<span className="font-normal text-ink-soft text-sm">
						{board.harvesting.length}
					</span>
				</h2>
				{board.harvesting.length === 0 ? (
					<p className="rounded-md border border-rule border-dashed p-3 text-ink-soft text-sm">
						Nothing is in season.
					</p>
				) : (
					<ul className="flex flex-wrap gap-2">
						{board.harvesting.map((season) => (
							<li
								key={`${season.context.plantingId}-${season.rule.id}`}
								className="flex items-center gap-2 rounded-md border border-harvest/40 bg-harvest-soft px-3 py-2"
							>
								<ActionChip action="harvest" />
								<Link
									href={`/plants/${season.context.plantSlug}`}
									className="font-medium hover:text-palace-700"
								>
									{season.context.label}
								</Link>
								<span className="text-ink-soft text-xs">
									until {formatLong(season.closesOn)}
								</span>
							</li>
						))}
					</ul>
				)}
			</section>

			<Section
				title="Coming up"
				count={board.upcoming.length}
				empty="Nothing opens in the next three weeks."
			>
				{board.upcoming.map((task) => (
					<TaskCard
						key={`${task.context.plantingId}-${task.occurrence.rule.id}-${task.occurrence.key}`}
						task={task}
						today={when}
					/>
				))}
			</Section>

			{board.recentlyDone.length > 0 && (
				<Section title="Recently done" count={board.recentlyDone.length} empty="">
					{board.recentlyDone.map((task) => (
						<TaskCard
							key={`${task.context.plantingId}-${task.occurrence.rule.id}-${task.occurrence.key}`}
							task={task}
							today={when}
						/>
					))}
				</Section>
			)}

			<p className="text-ink-soft text-xs">
				Ticking jobs off arrives in the next round. For now this is a read of{' '}
				<Link href="/grid" className="underline">
					the year
				</Link>{' '}
				against today&rsquo;s date.
			</p>
		</div>
	);
}
