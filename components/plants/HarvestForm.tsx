'use client';

import { useActionState } from 'react';
import { logHarvest } from '@/actions/care';
import type { IsoDate } from '@/lib/dates';

/**
 * Picking fruit isn't a job you finish, so this records one visit to the tree
 * and leaves the season open. Record as many as you like.
 */
export function HarvestForm({
	plantingId,
	ruleId,
	today,
	closesOn,
}: {
	plantingId: number;
	ruleId: number;
	today: IsoDate;
	closesOn: string;
}) {
	const [state, formAction, pending] = useActionState(logHarvest, null);

	return (
		<form
			action={formAction}
			className="space-y-2 rounded-md border border-harvest/40 bg-harvest-soft p-3"
		>
			<input type="hidden" name="plantingId" value={plantingId} />
			<input type="hidden" name="ruleId" value={ruleId} />
			<p className="font-medium text-sm">
				In season until {closesOn}. Picked something?
			</p>
			<div className="flex flex-wrap items-end gap-2">
				<label className="text-ink-soft text-xs">
					How much
					<input
						type="text"
						name="quantityNote"
						placeholder="3 kg"
						className="mt-0.5 block min-h-11 w-28 rounded-md border border-rule bg-paper px-2 text-ink text-sm"
					/>
				</label>
				<label className="text-ink-soft text-xs">
					On
					<input
						type="date"
						name="completedOn"
						defaultValue={today}
						max={today}
						className="mt-0.5 block min-h-11 rounded-md border border-rule bg-paper px-2 text-ink text-sm"
					/>
				</label>
				<button
					type="submit"
					disabled={pending}
					className="min-h-11 rounded-md bg-palace-200 px-4 font-medium text-palace-700 text-sm hover:bg-palace-300 disabled:opacity-50"
				>
					{pending ? 'Saving' : 'Record'}
				</button>
			</div>
			{state && !state.ok && <p className="text-prune text-xs">{state.error}</p>}
		</form>
	);
}
