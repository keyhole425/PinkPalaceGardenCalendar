'use client';

import { useActionState } from 'react';
import { createPlantType, updatePlantType } from '@/actions/plants';
import { Button } from '@/components/ui/Button';
import { inputClass, textareaClass } from '@/components/ui/Field';

const CATEGORIES = [
	['fruit_tree', 'Fruit tree'],
	['vegetable', 'Vegetable'],
	['herb', 'Herb'],
	['other', 'Something else'],
] as const;

const LIFECYCLES = [
	['perennial', 'Perennial — lives for years'],
	['annual', 'Annual — one season'],
	['biennial', 'Biennial — two seasons'],
] as const;

export type PlantFormValues = {
	id?: number;
	commonName?: string;
	scientificName?: string | null;
	category?: string;
	lifecycle?: string;
	family?: string | null;
	notesMd?: string | null;
};

export function PlantForm({ plant }: { plant?: PlantFormValues }) {
	const [state, formAction, pending] = useActionState(
		plant?.id ? updatePlantType : createPlantType,
		null,
	);

	return (
		<form action={formAction} className="max-w-xl space-y-3">
			{plant?.id && <input type="hidden" name="plantTypeId" value={plant.id} />}

			<label className="block text-ink-soft text-sm">
				Name
				<input
					name="commonName"
					defaultValue={plant?.commonName ?? ''}
					required
					placeholder="Kaffir lime"
					className={inputClass}
				/>
			</label>

			<label className="block text-ink-soft text-sm">
				Botanical name
				<input
					name="scientificName"
					defaultValue={plant?.scientificName ?? ''}
					placeholder="Citrus hystrix"
					className={inputClass}
				/>
			</label>

			<div className="flex flex-wrap gap-3">
				<label className="text-ink-soft text-sm">
					Kind
					<select
						name="category"
						defaultValue={plant?.category ?? 'fruit_tree'}
						className="mt-0.5 block min-h-tap rounded-md border border-rule px-2 text-ink"
					>
						{CATEGORIES.map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</label>

				<label className="text-ink-soft text-sm">
					Lifecycle
					<select
						name="lifecycle"
						defaultValue={plant?.lifecycle ?? 'perennial'}
						className="mt-0.5 block min-h-tap rounded-md border border-rule px-2 text-ink"
					>
						{LIFECYCLES.map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</label>

				<label className="text-ink-soft text-sm">
					Family
					<input
						name="family"
						defaultValue={plant?.family ?? ''}
						placeholder="Rutaceae"
						title="Used to warn you when the same family goes back in the same bed"
						className="mt-0.5 block min-h-tap w-40 rounded-md border border-rule px-2 text-ink"
					/>
				</label>
			</div>

			<label className="block text-ink-soft text-sm">
				Notes
				<textarea
					name="notesMd"
					rows={4}
					defaultValue={plant?.notesMd ?? ''}
					placeholder="Anything worth remembering, in your own words."
					className={textareaClass}
				/>
			</label>

			<div className="flex items-center gap-3">
				<Button type="submit" pending={pending} pendingLabel="Saving">
					{plant?.id ? 'Save' : 'Add it'}
				</Button>
				{state && !state.ok && (
					<span className="text-prune-deep text-sm">{state.error}</span>
				)}
				{state?.ok && <span className="text-fertilise-deep text-sm">Saved.</span>}
			</div>
		</form>
	);
}
