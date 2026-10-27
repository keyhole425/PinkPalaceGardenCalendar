import { notFound } from 'next/navigation';
import { PlaceForm, RemovePlace } from '@/components/beds/PlaceForm';
import { Card } from '@/components/ui/Card';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { requireHousehold } from '@/lib/auth/context';
import { getBed } from '@/lib/db/queries/beds';

export const dynamic = 'force-dynamic';

export default async function EditPlacePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const { householdId } = await requireHousehold();
	const place = await getBed(householdId, slug);
	if (!place) notFound();

	const growing = place.occupants.length;

	return (
		<Frame width="measure">
			<PageHeader
				back={{ href: `/garden/${place.slug}`, label: `← ${place.name}` }}
				title={`Change ${place.name}`}
			/>

			<div className="space-y-rhythm">
				<PlaceForm place={place} />

				<Card title="Remove this place">
					{growing > 0 ? (
						<p className="text-ink-soft text-sm">
							{growing === 1 ? 'One thing is' : `${growing} things are`} still
							growing here. Clear {growing === 1 ? 'it' : 'them'} from the
							place&rsquo;s page first.
						</p>
					) : (
						<>
							<p className="text-ink-soft text-sm">
								It comes off the garden and out of the sowing lists. What grew here
								stays in the record.
							</p>
							<RemovePlace id={place.id} name={place.name} />
						</>
					)}
				</Card>
			</div>
		</Frame>
	);
}
