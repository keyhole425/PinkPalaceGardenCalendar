import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JustDecided } from '@/components/library/JustDecided';
import { PlaceNewPlant } from '@/components/library/LibraryForms';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataList, DataRow } from '@/components/ui/DataList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScientificName } from '@/components/ui/ScientificName';
import { REGIONS } from '@/lib/ai/locale';
import { isSiteAdmin, requireHousehold } from '@/lib/auth/context';
import { justDecided, libraryOverview } from '@/lib/db/queries/curator';
import { householdRegion } from '@/lib/db/queries/household';
import { hereLine } from '@/lib/library/describe';
import { asRules } from '@/lib/library/suggestions';

export const dynamic = 'force-dynamic';

/**
 * The library, from the curator's side: what gardens have offered, where
 * their grows disagree with it, and every plant in it. For site admins only;
 * anyone else gets the same 404 as a wrong address.
 */
export default async function LibraryPage() {
	const ctx = await requireHousehold();
	if (!(await isSiteAdmin(ctx.userId))) notFound();
	const region = await householdRegion(ctx.householdId);
	const city = REGIONS[region].city;
	const overview = await libraryOverview(region);
	const decided = await justDecided(null);

	const waiting = overview.plants.filter((p) => p.open > 0);
	const flagged = overview.plants.filter((p) => p.flags.length > 0);
	const choices = overview.plants.map((p) => ({
		id: p.plant.id,
		name: p.plant.parent
			? `${p.plant.commonName} (a kind of ${p.plant.parent.commonName.toLowerCase()})`
			: p.plant.commonName,
		canHaveKinds: p.plant.parent === null,
	}));

	return (
		<Frame width="list">
			<PageHeader
				back={{ href: '/settings', label: '← Settings' }}
				title="The library"
				description={`What every garden reads about growing things in ${city}. Gardens suggest; nothing here changes until you accept it. Only site admins see this page.`}
			/>

			<div className="space-y-rhythm">
				<Card title="New plants" count={overview.newPlants.length}>
					<JustDecided decided={decided} />
					{overview.newPlants.length === 0 ? (
						<EmptyState>No new plants waiting.</EmptyState>
					) : (
						<DataList>
							{overview.newPlants.map(
								(s) =>
									s.kind === 'new_plant' && (
										<li key={s.id} className="space-y-2 px-3 py-3 text-sm">
											<p className="flex flex-wrap items-baseline gap-x-2">
												<span className="font-medium">{s.payload.commonName}</span>
												{s.payload.scientificName && (
													<ScientificName className="text-ink-soft">
														{s.payload.scientificName}
													</ScientificName>
												)}
												<span className="text-ink-soft text-xs">
													{s.payload.lifecycle}
													{s.payload.family && ` · ${s.payload.family}`}
												</span>
												{s.payload.citations.length > 0 && (
													<Badge title="Claude looked it up for the garden">
														looked up
													</Badge>
												)}
											</p>
											<p className="text-ink-soft text-xs">
												{hereLine(
													asRules(s.payload.rules),
													s.payload.daysToMaturityMin,
													s.payload.daysToMaturityMax,
												) || 'No months yet.'}
											</p>
											{s.payload.notesMd && (
												<p
													className="line-clamp-3 max-w-measure"
													title={s.payload.notesMd}
												>
													{s.payload.notesMd}
												</p>
											)}
											<PlaceNewPlant id={s.id} plants={choices} />
										</li>
									),
							)}
						</DataList>
					)}
				</Card>

				<Card title="Suggested changes" count={waiting.length}>
					{waiting.length === 0 ? (
						<EmptyState>
							Nothing suggested for the plants the library has.
						</EmptyState>
					) : (
						<DataList>
							{waiting.map(({ plant, open }) => (
								<DataRow key={plant.id} className="relative hover:bg-palace-50">
									<Link
										href={`/library/${plant.slug}`}
										className="font-medium after:absolute after:inset-0 after:content-['']"
									>
										{plant.commonName}
									</Link>
									<Badge tone="strong">{open} waiting</Badge>
								</DataRow>
							))}
						</DataList>
					)}
				</Card>

				{flagged.length > 0 && (
					<Card title="Worth a look" count={flagged.length}>
						<DataList>
							{flagged.map(({ plant, flags }) => (
								<DataRow key={plant.id} className="relative hover:bg-palace-50">
									<span className="w-full min-w-0 space-y-0.5">
										<Link
											href={`/library/${plant.slug}`}
											className="font-medium after:absolute after:inset-0 after:content-['']"
										>
											{plant.commonName}
										</Link>
										{flags.map((f) => (
											<span key={f} className="block text-ink-soft text-xs">
												{f}
											</span>
										))}
									</span>
								</DataRow>
							))}
						</DataList>
					</Card>
				)}

				<Card title="Every plant" count={overview.plants.length}>
					<DataList>
						{overview.plants.map(({ plant, grows }) => (
							<DataRow key={plant.id} className="relative hover:bg-palace-50">
								<Link
									href={`/library/${plant.slug}`}
									className="font-medium after:absolute after:inset-0 after:content-['']"
								>
									{plant.commonName}
								</Link>
								{plant.parent && (
									<span className="text-ink-soft text-xs">
										a kind of {plant.parent.commonName.toLowerCase()}
									</span>
								)}
								<span className="ml-auto text-ink-soft text-xs tabular-nums">
									{grows === 0
										? 'no grows yet'
										: grows === 1
											? '1 grow'
											: `${grows} grows`}
								</span>
							</DataRow>
						))}
					</DataList>
				</Card>
			</div>
		</Frame>
	);
}
