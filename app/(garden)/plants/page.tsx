import Link from 'next/link';
import { PlantIndexRow } from '@/components/plants/PlantIndexRow';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataList } from '@/components/ui/DataList';
import { EmptyState } from '@/components/ui/EmptyState';
import { inputClass } from '@/components/ui/Field';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { requireHousehold } from '@/lib/auth/context';
import {
	type IndexRow,
	type PlantCategory,
	plantsIndex,
	searchIndex,
} from '@/lib/db/queries/library';

export const dynamic = 'force-dynamic';

/** The order they are worth reading in, and what the rest of each is called. */
const MORE: [PlantCategory, string][] = [
	['vegetable', 'More vegetables'],
	['herb', 'More herbs'],
	['fruit_tree', 'More fruit trees'],
	['other', 'Everything else'],
];

/** What is growing first: those are the pages you open with a job to do. */
function growingFirst(a: IndexRow, b: IndexRow): number {
	const growing = Number((b.growing ?? 0) > 0) - Number((a.growing ?? 0) > 0);
	return growing || a.commonName.localeCompare(b.commonName);
}

export default async function PlantsPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string }>;
}) {
	const { householdId } = await requireHousehold();
	const query = ((await searchParams).q ?? '').trim().slice(0, 80);
	const index = await plantsIndex(householdId);

	return (
		<Frame width="list">
			<PageHeader
				title="Plants"
				description={
					<>
						What figgy knows about growing things in {index.city}. This is the
						reference, not{' '}
						<Link href="/garden" className="underline hover:text-palace-700">
							the garden
						</Link>
						.
					</>
				}
			/>

			<div className="space-y-rhythm">
				{/*
				 * A plain GET form: it works before any JavaScript has loaded,
				 * and a search is an address you can come back to.
				 */}
				<search data-tour="plants">
					<form action="/plants">
						<label className="block text-ink-soft text-sm">
							Look up a plant
							<span className="flex items-end gap-2">
								<input
									type="search"
									name="q"
									defaultValue={query}
									placeholder="tomato, habanero or Solanum"
									autoComplete="off"
									className={inputClass}
								/>
								<Button type="submit" className="shrink-0">
									Look up
								</Button>
							</span>
						</label>
					</form>
				</search>

				{query ? (
					<Results query={query} rows={searchIndex(index, query)} />
				) : (
					<Browse index={index} />
				)}
			</div>
		</Frame>
	);
}

function Browse({ index }: { index: Awaited<ReturnType<typeof plantsIndex>> }) {
	// The index lists plants; a kind of one is on its parent's page, and in
	// a search.
	const groups = MORE.map(([category, title]) => ({
		category,
		title,
		rows: index.more.filter((p) => p.category === category && !p.isVariety),
	})).filter((g) => g.rows.length > 0);

	return (
		<>
			<Card title="Your plants" count={index.yours.length}>
				{index.yours.length === 0 ? (
					<EmptyState>
						No plants of your own yet. Look one up and add it to your garden.
					</EmptyState>
				) : (
					<DataList>
						{[...index.yours].sort(growingFirst).map((row) => (
							<PlantIndexRow key={row.slug} row={row} />
						))}
					</DataList>
				)}
			</Card>

			{groups.map((group) => (
				<Card key={group.category} title={group.title} count={group.rows.length}>
					<DataList>
						{group.rows.map((row) => (
							<PlantIndexRow key={row.slug} row={row} />
						))}
					</DataList>
				</Card>
			))}

			<p className="text-ink-soft text-sm">
				Not here?{' '}
				<Link href="/plants/new" className="underline hover:text-palace-700">
					Add a plant figgy doesn&rsquo;t know
				</Link>
				.
			</p>
		</>
	);
}

function Results({ query, rows }: { query: string; rows: IndexRow[] }) {
	if (rows.length === 0) {
		return (
			<div className="space-y-2">
				<EmptyState>figgy doesn&rsquo;t know &ldquo;{query}&rdquo; yet.</EmptyState>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
					<ButtonLink
						variant="add"
						href={`/plants/new?q=${encodeURIComponent(query)}`}
					>
						Let figgy look it up
					</ButtonLink>
					<Link
						href="/plants/new#say-what-you-know"
						className="text-ink-soft text-sm underline hover:text-palace-700"
					>
						Or say what you know
					</Link>
				</div>
			</div>
		);
	}
	return (
		<Card title={`Matching “${query}”`} count={rows.length}>
			<DataList>
				{rows.map((row) => (
					<PlantIndexRow key={row.slug} row={row} showYours />
				))}
			</DataList>
		</Card>
	);
}
