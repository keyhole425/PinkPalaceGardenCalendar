import { AskForm } from '@/components/ai/AskForm';
import { PlantForm } from '@/components/plants/PlantForm';
import { Card } from '@/components/ui/Card';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { aiAvailable } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

export default function NewPlantPage() {
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
					<AskForm available={aiAvailable()} />
				</Card>

				<Card title="Or say what you know">
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
