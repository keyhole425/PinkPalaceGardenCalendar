import Link from 'next/link';
import { AskForm } from '@/components/ai/AskForm';
import { PlantForm } from '@/components/plants/PlantForm';
import { aiAvailable } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

export default function NewPlantPage() {
	return (
		<div className="space-y-6">
			<div>
				<p className="text-ink-soft text-sm">
					<Link href="/plants" className="hover:text-palace-700">
						Plants
					</Link>
				</p>
				<h1 className="font-semibold text-2xl">Add a plant</h1>
			</div>

			<section className="max-w-xl space-y-2">
				<h2 className="font-semibold text-lg">Let figgy look it up</h2>
				<p className="text-ink-soft text-sm">
					Name something and Claude will research how it is grown here, then propose
					a schedule for you to check.
				</p>
				<AskForm available={aiAvailable()} />
			</section>

			<section className="max-w-xl space-y-2">
				<h2 className="font-semibold text-lg">Or say what you know</h2>
				<p className="text-ink-soft text-sm">
					Name it now and set out what it needs next &mdash; you&rsquo;ll land on
					the rule editor straight after.
				</p>
				<PlantForm />
			</section>
		</div>
	);
}
