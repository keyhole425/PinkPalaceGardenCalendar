import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SuggestSomething } from '@/components/library/LibraryForms';
import { AddToGarden } from '@/components/plants/AddToGarden';
import { PlantIndexRow } from '@/components/plants/PlantIndexRow';
import { SowSome } from '@/components/plants/SowSome';
import { YourGarden } from '@/components/plants/YourGarden';
import { ActionChip } from '@/components/ui/ActionChip';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { DataList, DataRow } from '@/components/ui/DataList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Frame } from '@/components/ui/Frame';
import { Icon } from '@/components/ui/Icon';
import { MonthStrip } from '@/components/ui/MonthStrip';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScientificName } from '@/components/ui/ScientificName';
import { requireHousehold } from '@/lib/auth/context';
import { formatLong, monthOf, today } from '@/lib/dates';
import { type Article, getArticle } from '@/lib/db/queries/library';
import { getPlant } from '@/lib/db/queries/plant';
import type { Month } from '@/lib/schedule/months';
import { ACTION_LABEL } from '@/lib/ui/actions';

export const dynamic = 'force-dynamic';

/**
 * One plant, as an article: what it is, when to do what in this region, and
 * - once you grow it - your own plantings with their jobs. The same address
 * whether the plant is the library's, your copy of it, or yours alone.
 */
export default async function PlantPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ added?: string }>;
}) {
	const { slug } = await params;
	const added = (await searchParams).added === '1';
	const when = today();
	const { householdId } = await requireHousehold();
	const article = await getArticle(householdId, slug, when);
	if (!article) notFound();
	const mine = article.ownSlug
		? await getPlant(householdId, article.ownSlug, when)
		: null;
	const currentMonth = monthOf(when) as Month;
	const growing = mine?.plantings.length ?? 0;

	return (
		<Frame width="list">
			<PageHeader
				back={{ href: '/plants', label: '← Plants' }}
				title={article.commonName}
				description={<Description article={article} />}
				actions={
					mine ? (
						growing > 0 ? (
							<Badge tone="good">{growing} growing</Badge>
						) : (
							<Badge tone="quiet">in your plants</Badge>
						)
					) : (
						<AddToGarden slug={article.slug} />
					)
				}
			/>

			<div className="space-y-rhythm">
				{added && mine && (
					<p className="flex items-start gap-2 rounded-md border border-fertilise bg-fertilise-soft p-3 text-sm">
						<Icon
							name="check"
							className="mt-0.5 h-4 w-4 shrink-0 text-fertilise-deep"
						/>
						Added to your plants. figgy will say when it&rsquo;s time to sow.
					</p>
				)}

				{/* Something you have and haven't put anywhere: offer to. */}
				{mine && growing === 0 && article.places.length > 0 && (
					<SowSome
						slug={article.slug}
						plantTypeId={mine.id}
						places={article.places}
						today={when}
					/>
				)}

				{(article.summary || article.regionNote) && (
					<div className="max-w-measure space-y-2">
						{article.summary && (
							<p className="whitespace-pre-line text-sm">{article.summary}</p>
						)}
						{article.regionNote && (
							<Callout tone="note">
								In {article.city}: {lowerFirst(article.regionNote)}
							</Callout>
						)}
					</div>
				)}

				{mine && growing > 0 && (
					<Card title="Your garden" count={growing}>
						<div className="space-y-rhythm">
							<YourGarden plant={mine} when={when} currentMonth={currentMonth} />
						</div>
					</Card>
				)}

				<When article={article} mine={Boolean(mine)} currentMonth={currentMonth} />

				<Glance article={article} />

				{article.findings && (
					<Card title="What gardens found here">
						<p className="max-w-measure whitespace-pre-line text-sm">
							{article.findings}
						</p>
					</Card>
				)}

				{article.kinds && (
					<Card title={article.kinds.title} count={article.kinds.rows.length}>
						<DataList>
							{article.kinds.rows.map((row) => (
								<PlantIndexRow key={row.slug} row={row} />
							))}
						</DataList>
					</Card>
				)}

				{article.sections.map((section) => (
					<Card key={section.title} title={section.title}>
						<p className="max-w-measure whitespace-pre-line text-sm">
							{section.body}
						</p>
					</Card>
				))}

				{article.inLibrary && (
					<div className="space-y-1">
						{article.sections.length === 0 && (
							<Callout tone="quiet">
								That&rsquo;s all figgy knows about{' '}
								{article.commonName.toLowerCase()} so far.
							</Callout>
						)}
						<SuggestSomething slug={article.slug} />
					</div>
				)}

				{!article.inLibrary && (
					<Callout tone="quiet">
						Only in your garden. figgy&rsquo;s library doesn&rsquo;t have{' '}
						{article.commonName.toLowerCase()}.
					</Callout>
				)}

				{mine?.lookedUpIn && (
					<p className="text-ink-soft text-xs">
						Looked up by Claude.{' '}
						<Link
							href={`/proposals/${mine.lookedUpIn}`}
							className="underline hover:text-palace-700"
						>
							See the pages it read
						</Link>
						.
					</p>
				)}

				{article.citations.length > 0 && (
					<Card title="Sources" count={article.citations.length}>
						<DataList>
							{article.citations.map((c) => (
								<DataRow key={c.url}>
									<a
										href={c.url}
										rel="noopener noreferrer"
										target="_blank"
										className="underline hover:text-palace-700"
									>
										{c.title || new URL(c.url).hostname}
									</a>
								</DataRow>
							))}
						</DataList>
					</Card>
				)}
			</div>
		</Frame>
	);
}

function lowerFirst(text: string): string {
	return text.charAt(0).toLowerCase() + text.slice(1);
}

function Description({ article }: { article: Article }) {
	const facts = [article.lifecycle, article.family].filter(Boolean).join(' · ');
	return (
		<>
			{article.parent && (
				<>
					A kind of{' '}
					<Link
						href={`/plants/${article.parent.slug}`}
						className="underline hover:text-palace-700"
					>
						{article.parent.commonName.toLowerCase()}
					</Link>
					{' · '}
				</>
			)}
			{article.scientificName && (
				<>
					<ScientificName>{article.scientificName}</ScientificName>
					{' · '}
				</>
			)}
			{facts}
		</>
	);
}

function When({
	article,
	mine,
	currentMonth,
}: {
	article: Article;
	mine: boolean;
	currentMonth: Month;
}) {
	// "Transplant and harvest are the chilli's": said once, under the strips,
	// rather than as a badge on each.
	const inherited = article.when.filter((r) => r.from);
	const inheritedFrom = inherited[0]?.from;
	const inheritedActions = [
		...new Set(inherited.map((r) => ACTION_LABEL[r.action] ?? r.action)),
	];

	return (
		<Card
			title={`When, in ${article.city}`}
			aside={
				<span className="flex items-center gap-3">
					{article.needsReview && (
						<Badge
							tone="strong"
							title="These months are a general guide that nobody has checked for this garden"
						>
							needs review
						</Badge>
					)}
					{mine && (
						<ButtonLink
							variant="quiet"
							size="sm"
							href={`/plants/${article.ownSlug ?? article.slug}/edit`}
						>
							Change
						</ButtonLink>
					)}
				</span>
			}
		>
			{article.when.length === 0 ? (
				<EmptyState>
					figgy doesn&rsquo;t know when yet.
					{mine && (
						<>
							{' '}
							<Link
								href={`/plants/${article.ownSlug ?? article.slug}/edit`}
								className="underline hover:text-palace-700"
							>
								Fill the months in
							</Link>
							, or let Claude look it up from there.
						</>
					)}
				</EmptyState>
			) : (
				<div className="space-y-1">
					{article.when.map((rule, i) => (
						<div key={rule.ruleIds} className="flex items-end gap-2">
							{/*
							 * 72px: "Transplant" is 74px and leans into the gap, which
							 * is what lets the whole year fit a 375px phone without the
							 * year grid's "Transpl…".
							 */}
							<span className="w-18 shrink-0">
								<ActionChip action={rule.action} />
							</span>
							<MonthStrip
								action={rule.action}
								monthMask={rule.monthMask}
								currentMonth={currentMonth}
								labelled={i === 0}
							/>
						</div>
					))}
				</div>
			)}
			{(inheritedFrom ||
				article.shiftLines.length > 0 ||
				article.differs ||
				article.libraryChange) && (
				<div className="space-y-0.5 text-ink-soft text-xs">
					{inheritedFrom && (
						<p>
							{joinAnd(inheritedActions)}{' '}
							{inheritedActions.length === 1 ? 'is' : 'are'} the {inheritedFrom}
							&rsquo;s.
						</p>
					)}
					{article.shiftLines.map((line) => (
						<p key={line}>{line}</p>
					))}
					{article.libraryChange && (
						<p>
							Updated from the library on {formatLong(article.libraryChange.on)}:{' '}
							{article.libraryChange.what}.
						</p>
					)}
					{article.differs && (
						<p>
							Your months differ from the library&rsquo;s; yours are the ones on
							your schedule.
						</p>
					)}
				</div>
			)}
		</Card>
	);
}

function joinAnd(words: string[]): string {
	if (words.length <= 1) return words[0] ?? '';
	return `${words.slice(0, -1).join(', ')} and ${words.at(-1)?.toLowerCase()}`;
}

function Glance({ article }: { article: Article }) {
	const { daysToMaturityMin: min, daysToMaturityMax: max } = article;
	const rows = [
		min
			? [
					'Ready in',
					max && max !== min
						? `${min}–${max} days from sowing`
						: `${min} days from sowing`,
				]
			: null,
		article.spacingCm ? ['Spacing', `${article.spacingCm} cm apart`] : null,
		article.family ? ['Family', `${article.family}, for rotation`] : null,
	].filter((r): r is [string, string] => r !== null);
	if (rows.length === 0) return null;
	return (
		<Card title="At a glance">
			<DataList>
				{rows.map(([label, value]) => (
					<DataRow key={label}>
						<span className="w-20 shrink-0 text-ink-soft">{label}</span>
						<span>{value}</span>
					</DataRow>
				))}
			</DataList>
		</Card>
	);
}
