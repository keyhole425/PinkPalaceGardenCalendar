import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataList, DataRow } from '@/components/ui/DataList';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScientificName } from '@/components/ui/ScientificName';
import { listPlants } from '@/lib/db/queries/plant';

export const dynamic = 'force-dynamic';

type Plant = ReturnType<typeof listPlants>[number];

/** The order they are worth reading in, not alphabetical by label. */
const CATEGORIES = [
	['fruit_tree', 'Fruit trees'],
	['vegetable', 'Vegetables'],
	['herb', 'Herbs'],
	['other', 'Everything else'],
] as const;

export default async function PlantsPage() {
	const plants = listPlants();

	const byCategory = CATEGORIES.map(([key, label]) => ({
		key,
		label,
		plants: plants.filter((p) => p.category === key),
	})).filter((group) => group.plants.length > 0);

	return (
		<Frame width="list">
			<PageHeader
				title="Plants"
				description={
					<>
						Every kind of plant figgy knows how to grow, and what each one needs
						month by month. This is the reference, not the garden &mdash; what is
						actually in the ground is on{' '}
						<Link href="/garden" className="underline hover:text-palace-700">
							the garden
						</Link>
						.
					</>
				}
				actions={<ButtonLink href="/plants/new">Add a plant</ButtonLink>}
			/>

			<div className="space-y-rhythm">
				{byCategory.map((group) => (
					<Card key={group.key} title={group.label} count={group.plants.length}>
						<DataList>
							{group.plants.map((plant) => (
								<PlantRow key={plant.id} plant={plant} />
							))}
						</DataList>
					</Card>
				))}
			</div>
		</Frame>
	);
}

function PlantRow({ plant }: { plant: Plant }) {
	return (
		<DataRow
			action={
				<Link
					href={`/plants/${plant.slug}/edit`}
					className="text-ink-soft text-sm underline hover:text-palace-700"
				>
					Edit
				</Link>
			}
		>
			<Link
				href={`/plants/${plant.slug}`}
				className="font-medium hover:text-palace-700"
			>
				{plant.commonName}
			</Link>
			{plant.scientificName && (
				<ScientificName className="text-ink-soft text-sm">
					{plant.scientificName}
				</ScientificName>
			)}
			{/* The one fact that says whether this page is about you. */}
			{plant.plantingCount > 0 ? (
				<Badge tone="good">{plant.plantingCount} growing</Badge>
			) : (
				<span className="text-ink-faint text-xs">none planted</span>
			)}
			{plant.needsReview && (
				<Badge
					tone="strong"
					title="figgy does not know this plant's full schedule yet"
				>
					needs review
				</Badge>
			)}
		</DataRow>
	);
}
