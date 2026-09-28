import Link from 'next/link';
import { LogSentence } from '@/components/ai/LogSentence';
import { Section } from '@/components/tasks/Section';
import { TaskCard } from '@/components/tasks/TaskCard';
import { ActionChip } from '@/components/ui/ActionChip';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { WeatherStrip } from '@/components/weather/WeatherStrip';
import { aiAvailable } from '@/lib/ai/client';
import { formatLong, monthOf, today } from '@/lib/dates';
import { sowableThisMonth } from '@/lib/db/queries/beds';
import { getDashboard } from '@/lib/db/queries/garden';
import { monthName } from '@/lib/schedule/months';
import { getForecast, signalsFrom } from '@/lib/weather';

export const dynamic = 'force-dynamic';

export default async function NowPage() {
	const when = today();
	const board = getDashboard(when);
	const toSow = sowableThisMonth(when);
	const forecast = await getForecast(when);

	const taskKey = (t: (typeof board.overdue)[number]) =>
		`${t.context.plantingId}-${t.occurrence.rule.id}-${t.occurrence.key}`;

	// Nothing pressing? Then what is coming is the interesting part, so open it.
	const nothingPressing = board.overdue.length === 0 && board.due.length === 0;

	return (
		<Frame width="page">
			<PageHeader
				eyebrow={`${formatLong(when)} · ${monthName(monthOf(when))} in the garden`}
				title="What&rsquo;s on"
			/>

			{/*
			 * Both columns start at the top of the page. Logging used to sit
			 * above the grid as a full-width block, which pushed the weather and
			 * the two season lists a textarea's worth down the screen for the
			 * sake of something you open once a visit.
			 */}
			<div className="grid items-start gap-x-10 gap-y-rhythm lg:grid-cols-[minmax(0,1fr)_20rem]">
				{/* What you have to do. */}
				<div className="space-y-rhythm">
					<div className="max-w-measure">
						<LogSentence available={aiAvailable()} today={when} />
					</div>

					<Section
						title="Overdue"
						count={board.overdue.length}
						tone="alert"
						empty="Nothing missed in the last three months."
						max={8}
					>
						{board.overdue.map((task) => (
							<TaskCard key={taskKey(task)} task={task} today={when} />
						))}
					</Section>

					<Section
						title="Due now"
						count={board.due.length}
						empty="Nothing needs doing today."
						max={8}
					>
						{board.due.map((task) => (
							<TaskCard key={taskKey(task)} task={task} today={when} />
						))}
					</Section>

					{/*
					 * The two longest lists on the page, and neither is something
					 * you act on first. One summary row each until you ask.
					 */}
					<Section
						title="Coming up"
						count={board.upcoming.length}
						empty="Nothing opens in the next three weeks."
						collapsible
						defaultOpen={nothingPressing}
					>
						{board.upcoming.map((task) => (
							<TaskCard key={taskKey(task)} task={task} today={when} />
						))}
					</Section>

					{/*
					 * Open by default: this is the confirmation that a tap landed,
					 * and the only way back from a mis-tap. Capped instead, so it
					 * cannot run the length of the page.
					 */}
					{board.recentlyDone.length > 0 && (
						<Section
							title="Recently done"
							count={board.recentlyDone.length}
							empty=""
							collapsible
							defaultOpen
							max={5}
						>
							{board.recentlyDone.map((task) => (
								<TaskCard key={taskKey(task)} task={task} today={when} />
							))}
						</Section>
					)}
				</div>

				{/* What is worth knowing while you do it. */}
				<aside className="space-y-rhythm">
					{forecast && (
						<WeatherStrip
							forecast={forecast}
							signals={signalsFrom(forecast)}
							today={when}
						/>
					)}

					<Card title="Harvesting now" count={board.harvesting.length}>
						{board.harvesting.length === 0 ? (
							<EmptyState>Nothing is in season.</EmptyState>
						) : (
							<ul className="space-y-1">
								{board.harvesting.map((season) => (
									<li
										key={`${season.context.plantingId}-${season.rule.id}`}
										className="flex flex-wrap items-center gap-2 rounded-md border border-harvest bg-harvest-soft px-2 py-1.5"
									>
										<ActionChip action="harvest" />
										<Link
											href={`/plants/${season.context.plantSlug}`}
											className="font-medium text-sm hover:text-palace-700"
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
					</Card>

					<Card title="Could go in now" count={toSow.length}>
						{toSow.length === 0 ? (
							<EmptyState>Nothing wants sowing this month.</EmptyState>
						) : (
							<ul className="space-y-1">
								{toSow.map((crop) => (
									<li
										key={crop.plantTypeId}
										className="flex flex-wrap items-center gap-2 rounded-md border border-fertilise bg-fertilise-soft px-2 py-1.5"
									>
										<ActionChip action="sow" />
										<Link
											href={`/plants/${crop.slug}`}
											className="font-medium text-sm hover:text-palace-700"
										>
											{crop.commonName}
										</Link>
										<span className="text-ink-soft text-xs">
											{crop.places.map((p) => p.name).join(', ')}
										</span>
										{crop.places.some((p) => p.shifted) && (
											<Badge title="Brought forward because of where it would be growing">
												early inside
											</Badge>
										)}
									</li>
								))}
							</ul>
						)}
					</Card>
				</aside>
			</div>

			<p className="mt-rhythm max-w-measure text-ink-soft text-xs">
				Done today is one tap; open <em>Date or note</em> to back-date it or say how
				it went. Everything also shows on{' '}
				<Link href="/grid" className="underline">
					the year
				</Link>
				.
			</p>
		</Frame>
	);
}
