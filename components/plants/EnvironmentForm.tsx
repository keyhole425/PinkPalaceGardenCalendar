'use client';

import { useActionState, useState } from 'react';
import { createEnvironment } from '@/actions/plants';

const KINDS = [
	['orchard', 'Orchard — open ground, trees'],
	['bed', 'Bed — open ground, annuals'],
	['hothouse', 'Hothouse — under cover'],
	['pot', 'Pot'],
] as const;

export function EnvironmentForm() {
	const [state, formAction, pending] = useActionState(createEnvironment, null);
	const [shift, setShift] = useState(0);

	return (
		<form
			action={formAction}
			className="max-w-xl space-y-3 rounded-md border border-rule bg-paper-sunk p-3"
		>
			<div className="flex flex-wrap gap-3">
				<label className="text-ink-soft text-sm">
					Name
					<input
						name="name"
						required
						placeholder="The hothouse"
						className="mt-0.5 block min-h-11 rounded-md border border-rule bg-paper px-2 text-ink"
					/>
				</label>
				<label className="text-ink-soft text-sm">
					Kind
					<select
						name="kind"
						className="mt-0.5 block min-h-11 rounded-md border border-rule bg-paper px-2 text-ink"
					>
						{KINDS.map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</label>
			</div>

			<label className="flex items-start gap-2 text-sm">
				<input type="checkbox" name="frostFree" className="mt-1 h-4 w-4" />
				<span>
					Never frosts
					<span className="block text-ink-soft text-xs">
						True of a hothouse, and of anything else properly under cover.
					</span>
				</span>
			</label>

			<label className="block text-ink-soft text-sm">
				Runs ahead of the open garden by
				<span className="mt-0.5 flex items-center gap-2">
					<input
						type="range"
						name="windowShiftMonths"
						min={-3}
						max={3}
						value={shift}
						onChange={(e) => setShift(Number(e.target.value))}
						className="w-48"
					/>
					<span className="text-ink text-sm">
						{shift === 0
							? 'not at all'
							: shift < 0
								? `${Math.abs(shift)} month${Math.abs(shift) > 1 ? 's' : ''} earlier`
								: `${shift} month${shift > 1 ? 's' : ''} later`}
					</span>
				</span>
				<span className="mt-1 block text-ink-soft text-xs">
					Shifts every window that doesn&rsquo;t already name this place. Sow a
					month earlier inside, and figgy will ask a month earlier.
				</span>
			</label>

			<label className="block text-ink-soft text-sm">
				Notes
				<textarea
					name="notes"
					rows={2}
					className="mt-0.5 block w-full rounded-md border border-rule bg-paper px-2 py-1 text-ink text-sm"
				/>
			</label>

			<div className="flex items-center gap-3">
				<button
					type="submit"
					disabled={pending}
					className="min-h-11 rounded-md bg-palace-200 px-4 font-medium text-palace-700 hover:bg-palace-300 disabled:opacity-50"
				>
					{pending ? 'Saving' : 'Add it'}
				</button>
				{state && !state.ok && (
					<span className="text-prune text-sm">{state.error}</span>
				)}
				{state?.ok && <span className="text-fertilise text-sm">Added.</span>}
			</div>
		</form>
	);
}
