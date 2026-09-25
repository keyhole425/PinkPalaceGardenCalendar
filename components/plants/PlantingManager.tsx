'use client';

import { useActionState, useState } from 'react';
import { createPlanting, setPlantingStatus } from '@/actions/plants';

export type ListedPlanting = {
	id: number;
	label: string;
	status: string;
	quantity: number;
	plantedOn: string | null;
	environmentName: string;
};

export type EnvironmentOption = { id: number; name: string; kind: string };

function StatusForm({
	plantingId,
	status,
	slug,
}: {
	plantingId: number;
	status: string;
	slug: string;
}) {
	const [state, formAction, pending] = useActionState(setPlantingStatus, null);
	const next = status === 'active' ? 'removed' : 'active';

	return (
		<form action={formAction} className="inline">
			<input type="hidden" name="plantingId" value={plantingId} />
			<input type="hidden" name="status" value={next} />
			<input type="hidden" name="slug" value={slug} />
			<button
				type="submit"
				disabled={pending}
				className="text-ink-soft text-sm underline hover:text-palace-700 disabled:opacity-50"
				title={
					next === 'removed'
						? 'Stops asking to be pruned. Its history stays.'
						: 'Put it back on the schedule'
				}
			>
				{pending ? '…' : next === 'removed' ? 'Retire' : 'Bring back'}
			</button>
			{state && !state.ok && (
				<span className="ml-2 text-prune text-xs">{state.error}</span>
			)}
		</form>
	);
}

export function PlantingManager({
	plantTypeId,
	slug,
	plantings,
	environments,
}: {
	plantTypeId: number;
	slug: string;
	plantings: ListedPlanting[];
	environments: EnvironmentOption[];
}) {
	const [state, formAction, pending] = useActionState(createPlanting, null);
	const [adding, setAdding] = useState(plantings.length === 0);

	return (
		<div className="space-y-3">
			<ul className="divide-y divide-rule border border-rule">
				{plantings.map((p) => (
					<li
						key={p.id}
						className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm"
					>
						<span className="font-medium">{p.label}</span>
						<span className="text-ink-soft">{p.environmentName}</span>
						{p.plantedOn && (
							<span className="text-ink-soft text-xs">planted {p.plantedOn}</span>
						)}
						{p.status !== 'active' && (
							<span className="rounded-full bg-paper-sunk px-2 py-0.5 text-ink-soft text-xs">
								{p.status}
							</span>
						)}
						<span className="ml-auto">
							<StatusForm plantingId={p.id} status={p.status} slug={slug} />
						</span>
					</li>
				))}
				{plantings.length === 0 && (
					<li className="px-3 py-2 text-ink-soft text-sm">None planted yet.</li>
				)}
			</ul>

			{adding ? (
				<form
					action={formAction}
					className="space-y-3 rounded-md border border-rule bg-paper-sunk p-3"
				>
					<input type="hidden" name="plantTypeId" value={plantTypeId} />
					<div className="flex flex-wrap gap-3">
						<label className="text-ink-soft text-xs">
							What you call it
							<input
								name="label"
								required
								placeholder="Cherry #3"
								className="mt-0.5 block min-h-11 rounded-md border border-rule bg-paper px-2 text-ink text-sm"
							/>
						</label>
						<label className="text-ink-soft text-xs">
							Where
							<select
								name="environmentId"
								className="mt-0.5 block min-h-11 rounded-md border border-rule bg-paper px-2 text-ink text-sm"
							>
								{environments.map((e) => (
									<option key={e.id} value={e.id}>
										{e.name}
									</option>
								))}
							</select>
						</label>
						<label className="text-ink-soft text-xs">
							Planted
							<input
								type="date"
								name="plantedOn"
								className="mt-0.5 block min-h-11 rounded-md border border-rule bg-paper px-2 text-ink text-sm"
							/>
						</label>
					</div>
					<div className="flex items-center gap-3">
						<button
							type="submit"
							disabled={pending}
							className="min-h-11 rounded-md bg-palace-200 px-4 font-medium text-palace-700 text-sm hover:bg-palace-300 disabled:opacity-50"
						>
							{pending ? 'Saving' : 'Add'}
						</button>
						<button
							type="button"
							onClick={() => setAdding(false)}
							className="text-ink-soft text-sm underline"
						>
							Cancel
						</button>
						{state && !state.ok && (
							<span className="text-prune text-xs">{state.error}</span>
						)}
					</div>
				</form>
			) : (
				<button
					type="button"
					onClick={() => setAdding(true)}
					className="min-h-11 rounded-md border border-palace-300 border-dashed px-4 text-palace-700 text-sm hover:bg-palace-50"
				>
					Plant another one
				</button>
			)}
		</div>
	);
}
