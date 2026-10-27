import { AskForm } from '@/components/ai/AskForm';
import { PlantForm } from '@/components/plants/PlantForm';
import { Card } from '@/components/ui/Card';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { aiAvailable } from '@/lib/ai/client';
import { requireHousehold } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/** Research is two long calls to Claude; it carries on after the redirect. */
export const maxDuration = 300;

export default async function NewPlantPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string }>;
}) {
	const { householdId, role } = await requireHousehold();
	// Arriving from a search that found nothing, with the name already typed.
	const query = ((await searchParams).q ?? '').trim().slice(0, 120);
	const ai = await aiAvailable(householdId);
	return (
		<Frame width="measure">
			<PageHeader
				back={{ href: '/plants', label: '\u2190 Plants' }}
				title="Add a plant"
			/>

			<div className="space-y-rhythm">
				<Card title="Let figgy look it up">
					<p className="text-ink-soft text-sm">
						Name something and Claude will research how it is grown here, then
						propose a schedule for you to check.
					</p>
					<AskForm
						available={ai}
						canAddKey={role === 'admin'}
						defaultQuery={query || undefined}
					/>
				</Card>

				<Card title="Or say what you know" id="say-what-you-know">
					<p className="text-ink-soft text-sm">
						Name it now and set out what it needs next &mdash; you&rsquo;ll land on
						the rule editor straight after.
					</p>
					<PlantForm />
				</Card>
			</div>
		</Frame>
	);
}
