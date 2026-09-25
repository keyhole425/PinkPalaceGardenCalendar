import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AskForm } from '@/components/ai/AskForm';
import { PlantForm } from '@/components/plants/PlantForm';
import { PlantingManager } from '@/components/plants/PlantingManager';
import { ReviewedButton } from '@/components/plants/ReviewedButton';
import { RuleList } from '@/components/plants/RuleList';
import { aiAvailable } from '@/lib/ai/client';
import { monthOf, today } from '@/lib/dates';
import { db } from '@/lib/db/client';
import {
	getEditableRules,
	getPlantings,
	getRemovedActions,
	listEnvironments,
} from '@/lib/db/queries/plant';
import { plantType } from '@/lib/db/schema';
import type { Month } from '@/lib/schedule/months';

export const dynamic = 'force-dynamic';

export default async function EditPlantPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const plant = db.select().from(plantType).where(eq(plantType.slug, slug)).get();
	if (!plant) notFound();

	const rules = getEditableRules(plant.id);
	const removed = getRemovedActions(plant.id);
	const plantings = getPlantings(plant.id);
	const environments = listEnvironments();
	const currentMonth = monthOf(today()) as Month;

	return (
		<div className="space-y-8">
			<div>
				<p className="text-ink-soft text-sm">
					<Link href={`/plants/${plant.slug}`} className="hover:text-palace-700">
						{plant.commonName}
					</Link>
				</p>
				<h1 className="font-semibold text-2xl">Edit {plant.commonName}</h1>
			</div>

			{plant.needsReview && (
				<div className="space-y-3 rounded-md border border-palace-300 bg-palace-50 p-3 text-sm">
					<div className="flex flex-wrap items-center gap-3">
						<span>
							figgy doesn&rsquo;t have the full picture for this one. Fill in what
							it needs below, then say it&rsquo;s sorted.
						</span>
						<ReviewedButton plantTypeId={plant.id} />
					</div>
					<AskForm
						available={aiAvailable()}
						plantTypeId={plant.id}
						defaultQuery={plant.commonName}
						label="Ask Claude"
					/>
				</div>
			)}

			<section className="space-y-3">
				<h2 className="font-semibold text-lg">What it needs</h2>
				<p className="text-ink-soft text-sm">
					Months run July first, the same as the year grid.
				</p>
				<RuleList
					plantTypeId={plant.id}
					rules={rules}
					removedActions={removed}
					currentMonth={currentMonth}
				/>
			</section>

			<section className="space-y-3">
				<h2 className="font-semibold text-lg">
					The {plant.commonName.toLowerCase()} trees themselves
				</h2>
				<PlantingManager
					plantTypeId={plant.id}
					slug={plant.slug}
					plantings={plantings}
					environments={environments}
				/>
			</section>

			<section className="space-y-3">
				<h2 className="font-semibold text-lg">Details</h2>
				<PlantForm
					plant={{
						id: plant.id,
						commonName: plant.commonName,
						scientificName: plant.scientificName,
						category: plant.category,
						lifecycle: plant.lifecycle,
						family: plant.family,
						notesMd: plant.notesMd,
					}}
				/>
			</section>
		</div>
	);
}
