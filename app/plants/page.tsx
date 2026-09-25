import Link from 'next/link';
import { listPlants } from '@/lib/db/queries/plant';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
	fruit_tree: 'Fruit tree',
	vegetable: 'Vegetable',
	herb: 'Herb',
	other: 'Other',
};

export default async function PlantsPage() {
	const plants = listPlants();

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h1 className="font-semibold text-2xl">Plants</h1>
				<Link
					href="/plants/new"
					className="min-h-11 rounded-md bg-palace-200 px-4 py-2.5 font-medium text-palace-700 text-sm hover:bg-palace-300"
				>
					Add a plant
				</Link>
			</div>

			<ul className="divide-y divide-rule border border-rule">
				{plants.map((plant) => (
					<li
						key={plant.id}
						className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2"
					>
						<Link
							href={`/plants/${plant.slug}`}
							className="font-medium hover:text-palace-700"
						>
							{plant.commonName}
						</Link>
						{plant.scientificName && (
							<em className="text-ink-soft text-sm">{plant.scientificName}</em>
						)}
						<span className="text-ink-soft text-xs">
							{CATEGORY_LABEL[plant.category] ?? plant.category}
						</span>
						{plant.needsReview && (
							<span className="rounded-full bg-palace-200 px-2 py-0.5 text-palace-700 text-xs">
								needs review
							</span>
						)}
						<Link
							href={`/plants/${plant.slug}/edit`}
							className="ml-auto text-ink-soft text-sm underline hover:text-palace-700"
						>
							Edit
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
