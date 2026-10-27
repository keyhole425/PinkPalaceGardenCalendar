import { HarvestForm } from '@/components/plants/HarvestForm';
import { DoneForm, UndoButton } from '@/components/tasks/DoneForm';
import { ActionChip } from '@/components/ui/ActionChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthStrip } from '@/components/ui/MonthStrip';
import { formatLong, type IsoDate } from '@/lib/dates';
import { OVERDUE_LOOKBACK_DAYS } from '@/lib/db/queries/garden';
import type { PlantDetail } from '@/lib/db/queries/plant';
import { MONTH_ABBR, type Month, monthsInOrder } from '@/lib/schedule/months';
import type { Occurrence } from '@/lib/schedule/types';
import { ACTION_LABEL } from '@/lib/ui/actions';

const STATE_LABEL: Record<Occurrence['state'], string> = {
	done: 'done',
	due: 'due now',
	overdue: 'missed',
	upcoming: 'coming up',
	future: 'later',
};

const STATE_CLASS: Record<Occurrence['state'], string> = {
	done: 'bg-fertilise-soft text-ink',
	due: 'bg-palace-200 text-palace-700',
	overdue: 'bg-prune-soft text-ink',
	upcoming: 'bg-paper-sunk text-ink-soft',
	future: 'bg-paper-sunk text-ink-soft',
};

/**
 * A window that closed long ago with nothing logged against it wasn't
 * necessarily missed - figgy simply wasn't there. Only recent gaps are
 * called misses; older ones are honest about being unknown.
 */
function describe(occurrence: Occurrence, when: string) {
	if (occurrence.completedOn) {
		return {
			label: `done ${formatLong(occurrence.completedOn)}`,
			className: STATE_CLASS.done,
		};
	}
	if (
		occurrence.state === 'overdue' &&
		occurrence.closesOn < shiftDays(when, -OVERDUE_LOOKBACK_DAYS)
	) {
		return { label: 'no record', className: 'bg-paper-sunk text-ink-soft' };
	}
	return {
		label: STATE_LABEL[occurrence.state],
		className: STATE_CLASS[occurrence.state],
	};
}

function shiftDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/**
 * The household's own plantings of a plant: each one's windows, the jobs in
 * them with Done beside each, picking, and everything written down. This was
 * the whole plant page before the page became an article; it is the part of
 * it you open with a job to do, so the article puts it near the top.
 *
 * Each planting is an anchor, `#planting-{id}`, which is where a square on a
 * bed's plan opens.
 */
export function YourGarden({
	plant,
	when,
	currentMonth,
}: {
	plant: PlantDetail;
	when: IsoDate;
	currentMonth: Month;
}) {
	const thisYear = when.slice(0, 4);
	return (
		<>
			{plant.plantings.map((p) => (
				<section
					key={p.plantingId}
					id={`planting-${p.plantingId}`}
					// Opened from a square on a bed's plan: land on this one, with
					// room above it for the header it scrolled past.
					className="scroll-mt-6 space-y-3 rounded-md target:bg-palace-50 target:p-3"
				>
					<h3 className="font-semibold font-serif text-base">
						{p.label}
						<span className="ml-2 font-normal text-ink-soft text-sm">
							{p.environmentName}
						</span>
					</h3>

					<div className="space-y-2">
						<div className="flex items-center gap-2 text-ink-soft text-xs">
							<span className="w-18 shrink-0" />
							<div className="flex gap-px">
								{monthsInOrder(7).map((m) => (
									<span key={m} className="w-5 text-center">
										{MONTH_ABBR[m - 1].slice(0, 1)}
									</span>
								))}
							</div>
						</div>
						{p.rules.map((rule) => (
							<div
								key={rule.id}
								className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
							>
								<span className="w-18 shrink-0">
									<ActionChip action={rule.action} />
								</span>
								<MonthStrip
									action={rule.action}
									monthMask={rule.monthMask}
									currentMonth={currentMonth}
								/>
								{rule.shifted && (
									<span className="text-ink-soft text-xs">
										shifted for {p.environmentName.toLowerCase()}
									</span>
								)}
							</div>
						))}
					</div>

					<div>
						<h4 className="mb-1 font-medium text-ink-soft text-sm">
							{thisYear} and either side
						</h4>
						<ul className="divide-y divide-rule border border-rule">
							{p.occurrences.map((o) => {
								const shown = describe(o, when);
								return (
									<li
										key={`${o.rule.id}-${o.key}`}
										className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
									>
										<span className="w-24 shrink-0 font-medium">
											{ACTION_LABEL[o.rule.action] ?? o.rule.action}
										</span>
										<span className="text-ink-soft">
											{formatLong(o.opensOn)} &ndash; {formatLong(o.closesOn)}
										</span>
										<span
											className={`ml-auto rounded-full px-2 py-0.5 text-xs ${shown.className}`}
										>
											{shown.label}
										</span>
										{o.state === 'done' && o.logId !== null ? (
											<UndoButton logId={o.logId} slug={plant.slug} />
										) : (
											o.state !== 'future' && (
												<DoneForm
													plantingId={p.plantingId}
													ruleId={o.rule.id}
													occurrenceKey={o.key}
													today={when}
													label={
														shown.label === 'no record' ? 'record it' : 'Mark done'
													}
													quiet={shown.label === 'no record'}
												/>
											)
										)}
									</li>
								);
							})}
							{p.occurrences.length === 0 && (
								<li className="px-3 py-2 text-ink-soft text-sm">
									Nothing scheduled. Harvest windows are a season, not a job, so
									they don&rsquo;t appear here.
								</li>
							)}
						</ul>
					</div>

					{p.openSeasons.map((season) => (
						<HarvestForm
							key={season.rule.id}
							plantingId={p.plantingId}
							ruleId={season.rule.id}
							today={when}
							closesOn={formatLong(season.closesOn)}
						/>
					))}

					<div>
						<h4 className="mb-1 font-medium text-ink-soft text-sm">History</h4>
						{p.history.length === 0 ? (
							<EmptyState>Nothing written down yet.</EmptyState>
						) : (
							<ol className="divide-y divide-rule border border-rule">
								{p.history.map((entry) => (
									<li
										key={entry.id}
										className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm"
									>
										<span className="w-24 shrink-0 font-medium">
											{ACTION_LABEL[entry.action] ?? entry.action}
										</span>
										<span className="text-ink-soft">
											{formatLong(entry.completedOn)}
										</span>
										{entry.quantityNote && (
											<span className="rounded-full bg-harvest-soft px-2 py-0.5 text-xs">
												{entry.quantityNote}
											</span>
										)}
										{entry.notesMd && (
											<span className="w-full text-ink-soft text-xs">
												{entry.notesMd}
											</span>
										)}
										<span className="ml-auto">
											<UndoButton
												logId={entry.id}
												slug={plant.slug}
												label="Remove"
											/>
										</span>
									</li>
								))}
							</ol>
						)}
					</div>
				</section>
			))}
		</>
	);
}
