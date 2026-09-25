import Link from 'next/link';
import { PlantForm } from '@/components/plants/PlantForm';

export default function NewPlantPage() {
	return (
		<div className="space-y-4">
			<p className="text-ink-soft text-sm">
				<Link href="/plants" className="hover:text-palace-700">
					Plants
				</Link>
			</p>
			<h1 className="font-semibold text-2xl">Add a plant</h1>
			<p className="max-w-xl text-ink-soft text-sm">
				Name it now and say what it needs next &mdash; you&rsquo;ll land on the rule
				editor straight after.
			</p>
			<PlantForm />
		</div>
	);
}
