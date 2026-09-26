import Link from 'next/link';
import { BedPlan } from '@/components/beds/BedPlan';
import { EnvironmentForm } from '@/components/plants/EnvironmentForm';
import { Badge } from '@/components/ui/Badge';
import { DataList, DataRow } from '@/components/ui/DataList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Bed } from '@/lib/db/queries/beds';
import { listPlaces } from '@/lib/db/queries/beds';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
	orchard: 'Orchard',
	bed: 'Bed',
	hothouse: 'Hothouse',
	pot: 'Pot',
};

/** Places you sow into are drawn as a plan; the orchard is a list of trees. */
function hasPlan(place: Bed): boolean {
	return place.kind !== 'orchard';
}

export default async function GardenPage() {
	const places = listPlaces();

	return (
		<Frame width="page">
			<PageHeader
				title="The garden"
				description="Everywhere things grow here, and what is in each one. A place that
					runs ahead of the open garden - the hothouse - has its windows moved to
					match, so the same tomato is sowable earlier inside than out."
			/>

			{places.length === 0 ? (
				<EmptyState>No places yet. Add one below.</EmptyState>
			) : (
				/*
				 * A bed is a small square plan and pairs up neatly; the orchard is
				 * a list of a dozen trees and would leave its neighbour stranded
				 * beside a column of whitespace. So the plans go two-up and the
				 * lists take the full width.
				 */
				<div className="space-y-rhythm">
					{places
						.filter((p) => !hasPlan(p))
						.map((place) => (
							<Place key={place.id} place={place} />
						))}
					<div className="grid gap-x-8 gap-y-rhythm md:grid-cols-2">
						{places.filter(hasPlan).map((place) => (
							<Place key={place.id} place={place} />
						))}
					</div>
				</div>
			)}

			<details className="mt-10">
				<summary className="inline-flex min-h-tap cursor-pointer list-none items-center font-semibold font-serif text-lg">
					Add a place
				</summary>
				<div className="mt-2 max-w-measure">
					<EnvironmentForm />
				</div>
			</details>
		</Frame>
	);
}

function Place({ place }: { place: Bed }) {
	const spots = place.gridCols * place.gridRows;
	const taken = place.occupants.length;

	return (
		<section className="space-y-2">
			<h2 className="flex flex-wrap items-baseline gap-2">
				<Link
					href={`/garden/${place.slug}`}
					className="font-semibold font-serif text-lg hover:text-palace-700"
				>
					{place.name}
				</Link>
				<span className="text-ink-soft text-xs">
					{KIND_LABEL[place.kind] ?? place.kind}
				</span>
				{place.frostFree && <Badge tone="good">frost free</Badge>}
				{place.windowShiftMonths !== 0 && (
					<Badge>
						{Math.abs(place.windowShiftMonths)} month
						{Math.abs(place.windowShiftMonths) > 1 ? 's' : ''}{' '}
						{place.windowShiftMonths < 0 ? 'ahead' : 'behind'}
					</Badge>
				)}
				<span className="ml-auto text-ink-faint text-xs tabular-nums">
					{hasPlan(place)
						? `${taken} of ${spots} spots`
						: `${taken} ${taken === 1 ? 'tree' : 'trees'}`}
				</span>
			</h2>

			{hasPlan(place) ? (
				<BedPlan bed={place} href={() => `/garden/${place.slug}`} />
			) : taken === 0 ? (
				<EmptyState>Nothing growing here yet.</EmptyState>
			) : (
				<DataList className="md:columns-2 md:[&>li]:break-inside-avoid">
					{place.occupants.map((tree) => (
						<DataRow key={tree.plantingId}>
							<Link
								href={`/plants/${tree.plantSlug}`}
								className="font-medium hover:text-palace-700"
							>
								{tree.label}
							</Link>
							<span className="text-ink-soft text-xs">{tree.plantName}</span>
						</DataRow>
					))}
				</DataList>
			)}
		</section>
	);
}
