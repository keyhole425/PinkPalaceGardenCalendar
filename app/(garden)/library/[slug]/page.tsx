import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JustDecided } from '@/components/library/JustDecided';
import { ArticleEditor, DecideSuggestion } from '@/components/library/LibraryForms';
import { ActionChip } from '@/components/ui/ActionChip';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { DataList, DataRow } from '@/components/ui/DataList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Frame } from '@/components/ui/Frame';
import { MonthStrip } from '@/components/ui/MonthStrip';
import { PageHeader } from '@/components/ui/PageHeader';
import { REGIONS } from '@/lib/ai/locale';
import { isSiteAdmin, requireHousehold } from '@/lib/auth/context';
import { monthOf, today } from '@/lib/dates';
import {
	curatorPlant,
	justDecided,
	type Suggestion,
} from '@/lib/db/queries/curator';
import { householdRegion } from '@/lib/db/queries/household';
import { actionOrder, type RuleLike, windowText } from '@/lib/library/describe';
import { asRules } from '@/lib/library/suggestions';
import { type Month, monthAbbr } from '@/lib/schedule/months';
import { ACTION_LABEL } from '@/lib/ui/actions';

export const dynamic = 'force-dynamic';

/** Strips for a set of rules, one per action, as the article draws them. */
function Strips({
	rules,
	currentMonth,
}: {
	rules: RuleLike[];
	currentMonth: Month;
}) {
	const actions = [...new Set(rules.map((r) => r.action))].sort(
		(a, b) => actionOrder(a) - actionOrder(b),
	);
	if (actions.length === 0)
		return <p className="text-ink-soft text-sm">No months.</p>;
	return (
		<div className="space-y-1">
			{actions.map((action, i) => (
				<div key={action} className="flex items-end gap-2">
					<span className="w-18 shrink-0">
						<ActionChip action={action} />
					</span>
					<MonthStrip
						action={action}
						monthMask={rules
							.filter((r) => r.action === action)
							.reduce((mask, r) => mask | r.monthMask, 0)}
						currentMonth={currentMonth}
						labelled={i === 0}
					/>
				</div>
			))}
		</div>
	);
}

function label(action: string): string {
	return (ACTION_LABEL[action] ?? action).toLowerCase();
}

function SuggestionBlock({
	suggestion,
	library,
	currentMonth,
}: {
	suggestion: Suggestion;
	library: RuleLike[];
	currentMonth: Month;
}) {
	switch (suggestion.kind) {
		case 'rule_change': {
			const { rule, removed } = suggestion.payload;
			const theirs = asRules([rule]);
			const ours = library.filter((r) => r.action === rule.action);
			return (
				<>
					<p className="font-medium">
						{removed
							? `A garden stopped doing “${label(rule.action)}” at all.`
							: `A garden moved ${label(rule.action)} to ${windowText(theirs)}.`}
					</p>
					{!removed && (
						<div className="space-y-1">
							<p className="text-ink-soft text-xs">
								Theirs, then the library&rsquo;s{ours.length === 0 ? ' (none)' : ''}
								:
							</p>
							<Strips rules={theirs} currentMonth={currentMonth} />
							{ours.length > 0 && (
								<Strips rules={ours} currentMonth={currentMonth} />
							)}
						</div>
					)}
					<DecideSuggestion id={suggestion.id} />
				</>
			);
		}
		case 'research':
			return (
				<>
					<p className="font-medium">
						Claude looked it up for a garden, and they kept it.
					</p>
					<Strips
						rules={asRules(suggestion.payload.rules)}
						currentMonth={currentMonth}
					/>
					{suggestion.payload.suitability && (
						<p className="max-w-measure text-ink-soft">
							{suggestion.payload.suitability}
						</p>
					)}
					{suggestion.payload.citations.length > 0 && (
						<p className="text-ink-soft text-xs">
							From{' '}
							{suggestion.payload.citations
								.slice(0, 3)
								.map((c) => new URL(c.url).hostname)
								.join(', ')}
							{suggestion.payload.citations.length > 3 &&
								` and ${suggestion.payload.citations.length - 3} more`}
							.
						</p>
					)}
					<DecideSuggestion id={suggestion.id} acceptLabel="Accept its months" />
				</>
			);
		case 'note':
			return (
				<>
					<Callout tone="quiet">{suggestion.payload.text}</Callout>
					<DecideSuggestion id={suggestion.id} acceptLabel="Mark read" />
				</>
			);
		default:
			return null;
	}
}

/**
 * One library plant, from the curator's side: what is suggested for it, what
 * gardens' grows say, and the words of its article. For site admins only.
 */
export default async function LibraryPlantPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const ctx = await requireHousehold();
	if (!(await isSiteAdmin(ctx.userId))) notFound();
	const { slug } = await params;
	const region = await householdRegion(ctx.householdId);
	const city = REGIONS[region].city;
	const found = await curatorPlant(slug, region);
	if (!found) notFound();
	const { plant, suggestions, evidence, ownRegionNote } = found;
	const currentMonth = monthOf(today()) as Month;
	const decided = await justDecided(plant.id);

	return (
		<Frame width="list">
			<PageHeader
				back={{ href: '/library', label: '← The library' }}
				title={plant.commonName}
				description={
					<>
						{plant.parent && (
							<>
								A kind of{' '}
								<Link
									href={`/library/${plant.parent.slug}`}
									className="underline hover:text-palace-700"
								>
									{plant.parent.commonName.toLowerCase()}
								</Link>
								{' · '}
							</>
						)}
						revision {plant.revision} ·{' '}
						<Link
							href={`/plants/${plant.slug}`}
							className="underline hover:text-palace-700"
						>
							see the article
						</Link>
					</>
				}
			/>

			<div className="space-y-rhythm">
				<Card title="Suggested" count={suggestions.length}>
					<JustDecided decided={decided} />
					{suggestions.length === 0 ? (
						<EmptyState>
							Nothing suggested for {plant.commonName.toLowerCase()}.
						</EmptyState>
					) : (
						<DataList>
							{suggestions.map((s) => (
								<li key={s.id} className="space-y-2 px-3 py-3 text-sm">
									<SuggestionBlock
										suggestion={s}
										library={plant.rules}
										currentMonth={currentMonth}
									/>
								</li>
							))}
						</DataList>
					)}
				</Card>

				<Card title={`The library’s months, in ${city}`}>
					<Strips rules={plant.rules} currentMonth={currentMonth} />
					{plant.rules.some((r) => r.from !== plant.commonName) && (
						<p className="text-ink-soft text-xs">
							Some are its parent&rsquo;s. Accepting a change here gives it months
							of its own for that action.
						</p>
					)}
				</Card>

				<Card title="What gardens found" count={evidence.grows}>
					{evidence.grows === 0 ? (
						<EmptyState>No grows recorded yet.</EmptyState>
					) : (
						<>
							<p className="text-ink-soft text-sm">
								{evidence.grows === 1 ? 'One grow' : `${evidence.grows} grows`} in{' '}
								{evidence.gardens === 1
									? 'one garden'
									: `${evidence.gardens} gardens`}
								{evidence.medianDays !== null &&
									`, first picked after ${evidence.medianDays} days, typically`}
								.
							</p>
							{evidence.flags.map((f) => (
								<Callout key={f} tone="warn">
									{f}
								</Callout>
							))}
							{evidence.bySowMonth.length > 0 && (
								<DataList>
									{evidence.bySowMonth.map((m) => (
										<DataRow key={m.month}>
											<span className="w-20 shrink-0 font-medium">
												Sown {monthAbbr(m.month as Month)}
											</span>
											<span className="text-ink-soft">
												{[
													m.harvested && `${m.harvested} picked`,
													m.lost && `${m.lost} lost`,
													m.growing && `${m.growing} still growing`,
												]
													.filter(Boolean)
													.join(' · ')}
												{m.medianDays !== null &&
													` · first picked after ~${m.medianDays} days`}
											</span>
										</DataRow>
									))}
								</DataList>
							)}
							{evidence.notes.length > 0 && (
								<div className="space-y-1">
									<h3 className="font-medium text-ink-soft text-sm">
										What they wrote, names taken out
									</h3>
									<DataList>
										{evidence.notes.map((note, i) => (
											// Notes repeat across grows; the position keeps them apart.
											// biome-ignore lint/suspicious/noArrayIndexKey: see above
											<DataRow key={i} className="text-ink-soft">
												{note}
											</DataRow>
										))}
									</DataList>
								</div>
							)}
						</>
					)}
				</Card>

				<Card title="The article">
					<p className="text-ink-soft text-sm">
						Saving publishes it to every garden that has{' '}
						{plant.commonName.toLowerCase()}. A section left empty is left off the
						page
						{plant.parent ? ', and an empty one on a kind shows its parent’s' : ''}.
					</p>
					<ArticleEditor
						city={city}
						article={{
							id: plant.id,
							summary: found.own.summary,
							regionNote: ownRegionNote,
							growingMd: found.own.growingMd,
							careMd: found.own.careMd,
							harvestMd: found.own.harvestMd,
							problemsMd: found.own.problemsMd,
							findingsMd: found.own.findingsMd,
						}}
					/>
				</Card>
			</div>
		</Frame>
	);
}
