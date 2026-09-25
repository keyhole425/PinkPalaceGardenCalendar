import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HarvestForm } from '@/components/plants/HarvestForm';
import { RuleStrip } from '@/components/plants/RuleStrip';
import { DoneForm, UndoButton } from '@/components/tasks/DoneForm';
import { ACTION_LABEL, ActionChip } from '@/components/tasks/TaskCard';
import { formatLong, monthOf, today } from '@/lib/dates';
import { OVERDUE_LOOKBACK_DAYS } from '@/lib/db/queries/garden';
import { getPlant } from '@/lib/db/queries/plant';
import { MONTH_ABBR, type Month, monthsInOrder } from '@/lib/schedule/months';
import type { Occurrence } from '@/lib/schedule/types';

export const dynamic = 'force-dynamic';

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

export default async function PlantPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const when = today();
	const plant = getPlant(slug, when);
	if (!plant) notFound();

	const currentMonth = monthOf(when) as Month;
	const thisYear = when.slice(0, 4);

	return (
		<div className="space-y-6">
			<header className="space-y-1">
				<p className="text-ink-soft text-sm">
					<Link href="/grid" className="hover:text-palace-700">
						The year
					</Link>
				</p>
				<h1 className="font-semibold text-2xl">
					{plant.commonName}
					{plant.needsReview && (
						<span className="ml-3 rounded-full bg-palace-200 px-2 py-1 align-middle font-normal text-palace-700 text-xs">
							needs review
						</span>
					)}
				</h1>
				<p className="text-ink-soft text-sm">
					{plant.scientificName && <em>{plant.scientificName}</em>}
					{plant.scientificName && ' · '}
					{plant.lifecycle}
					{plant.family && ` · ${plant.family}`}
				</p>
			</header>

			{plant.notesMd && (
				<section>
					<h2 className="mb-1 font-semibold text-lg">Notes</h2>
					<blockquote className="whitespace-pre-line border-palace-300 border-l-4 bg-palace-50 py-2 pl-3 text-sm">
						{plant.notesMd}
					</blockquote>
					{plant.sourceRef && (
						<p className="mt-1 text-ink-soft text-xs">
							From <code>{plant.sourceRef}</code>, kept word for word.
						</p>
					)}
				</section>
			)}

			{plant.needsReview && (
				<p className="rounded-md border border-palace-300 bg-palace-50 p-3 text-sm">
					figgy doesn&rsquo;t have the full picture for this one &mdash; the
					spreadsheet left gaps. Filling them in is coming up.
				</p>
			)}

			{plant.plantings.map((p) => (
				<section key={p.plantingId} className="space-y-3">
					<h2 className="font-semibold text-lg">
						{p.label}
						<span className="ml-2 font-normal text-ink-soft text-sm">
							{p.environmentName}
						</span>
					</h2>

					<div className="space-y-2">
						<div className="flex items-center gap-2 text-ink-soft text-xs">
							<span className="w-24" />
							<div className="flex gap-px">
								{monthsInOrder(7).map((m) => (
									<span key={m} className="w-5 text-center">
										{MONTH_ABBR[m - 1].slice(0, 1)}
									</span>
								))}
							</div>
						</div>
						{p.rules.map((rule) => (
							<div key={rule.id} className="flex items-center gap-2">
								<span className="w-24 shrink-0">
									<ActionChip action={rule.action} />
								</span>
								<RuleStrip rule={rule} currentMonth={currentMonth} />
								{rule.shifted && (
									<span className="text-ink-soft text-xs">
										shifted for {p.environmentName.toLowerCase()}
									</span>
								)}
							</div>
						))}
					</div>

					<div>
						<h3 className="mb-1 font-medium text-ink-soft text-sm">
							{thisYear} and either side
						</h3>
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
						<h3 className="mb-1 font-medium text-ink-soft text-sm">History</h3>
						{p.history.length === 0 ? (
							<p className="rounded-md border border-rule border-dashed p-3 text-ink-soft text-sm">
								Nothing written down yet.
							</p>
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
		</div>
	);
}
