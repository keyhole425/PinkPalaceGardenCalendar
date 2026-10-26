import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { AskForm } from '@/components/ai/AskForm';
import { PlantForm } from '@/components/plants/PlantForm';
import { PlantingManager } from '@/components/plants/PlantingManager';
import { ReviewedButton } from '@/components/plants/ReviewedButton';
import { RuleList } from '@/components/plants/RuleList';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { aiAvailable } from '@/lib/ai/client';
import { requireHousehold } from '@/lib/auth/context';
import { monthOf, today } from '@/lib/dates';
import { db } from '@/lib/db/client';
import {
	getEditableRules,
	getPlantings,
	getRemovedActions,
	listEnvironments,
} from '@/lib/db/queries/plant';
import { plantType } from '@/lib/db/schema';
import { owns } from '@/lib/db/tenancy';
import type { Month } from '@/lib/schedule/months';

export const dynamic = 'force-dynamic';

export default async function EditPlantPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const { householdId } = await requireHousehold();
	const plant = await db
		.select()
		.from(plantType)
		.where(and(owns(plantType, householdId), eq(plantType.slug, slug)))
		.get();
	if (!plant) notFound();

	const [rules, removed, plantings, environments] = await Promise.all([
		getEditableRules(householdId, plant.id),
		getRemovedActions(householdId, plant.id),
		getPlantings(householdId, plant.id),
		listEnvironments(householdId),
	]);
	const currentMonth = monthOf(today()) as Month;

	return (
		<Frame width="list">
			<PageHeader
				back={{
					href: `/plants/${plant.slug}`,
					label: `\u2190 ${plant.commonName}`,
				}}
				title={`Edit ${plant.commonName}`}
			/>

			<div className="space-y-8">
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
		</Frame>
	);
}
