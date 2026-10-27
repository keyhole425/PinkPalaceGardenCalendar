'use client';

import { useActionState, useState } from 'react';
import { createPlace, removePlace, updatePlace } from '@/actions/places';
import { Button } from '@/components/ui/Button';
import {
	Field,
	inputClass,
	selectClass,
	textareaClass,
} from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';

const KINDS = [
	['bed', 'Bed — open ground, annuals'],
	['raised_bed', 'Raised bed — built up, annuals'],
	['hothouse', 'Hothouse — under cover'],
	['pot', 'Pot'],
	['orchard', 'Orchard — open ground, trees'],
] as const;

export type PlaceFormValues = {
	id: number;
	name: string;
	kind: string;
	gridCols: number;
	gridRows: number;
	widthCm: number | null;
	lengthCm: number | null;
	frostFree: boolean;
	windowShiftMonths: number;
	notes: string | null;
};

function plural(n: number, one: string, many: string) {
	return `${n} ${n === 1 ? one : many}`;
}

/**
 * Adding a place, or changing one.
 *
 * Spots start empty on a new place on purpose. A missing size used to become
 * 4 by 2, which is how every bed in the garden ended up with eight spots.
 */
export function PlaceForm({ place }: { place?: PlaceFormValues }) {
	const [state, formAction, pending] = useActionState(
		place ? updatePlace : createPlace,
		null,
	);
	const [kind, setKind] = useState(place?.kind ?? 'bed');
	const [cols, setCols] = useState(place ? String(place.gridCols) : '');
	const [rows, setRows] = useState(place ? String(place.gridRows) : '');
	const [shift, setShift] = useState(place?.windowShiftMonths ?? 0);

	const across = Number(cols);
	const deep = Number(rows);
	const sized =
		Number.isInteger(across) && across > 0 && Number.isInteger(deep) && deep > 0;

	return (
		<form action={formAction} className="space-y-3">
			{place && <input type="hidden" name="environmentId" value={place.id} />}

			<Field label="Name">
				<input
					name="name"
					required
					maxLength={80}
					defaultValue={place?.name ?? ''}
					placeholder="The hothouse"
					className={inputClass}
				/>
			</Field>

			<Field label="Kind">
				<select
					name="kind"
					value={kind}
					onChange={(e) => setKind(e.target.value)}
					className={selectClass}
				>
					{KINDS.map(([value, label]) => (
						<option key={value} value={value}>
							{label}
						</option>
					))}
				</select>
			</Field>

			{kind === 'orchard' ? (
				<p className="text-ink-soft text-sm">
					The orchard has no grid of spots; its trees are a list.
				</p>
			) : (
				<fieldset className="space-y-1">
					<legend className="text-ink-soft text-sm">Spots</legend>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Across">
							<input
								name="gridCols"
								type="number"
								inputMode="numeric"
								required
								min={1}
								max={12}
								value={cols}
								onChange={(e) => setCols(e.target.value)}
								className={inputClass}
							/>
						</Field>
						<Field label="Deep">
							<input
								name="gridRows"
								type="number"
								inputMode="numeric"
								required
								min={1}
								max={12}
								value={rows}
								onChange={(e) => setRows(e.target.value)}
								className={inputClass}
							/>
						</Field>
					</div>
					<p aria-live="polite" className="text-ink-faint text-xs">
						{sized
							? `${plural(across * deep, 'spot', 'spots')}, ${across} across and ${deep} deep.`
							: 'How many plants fit each way. Up to 12.'}
					</p>
				</fieldset>
			)}

			<label className="flex items-start gap-2 text-sm">
				<input
					type="checkbox"
					name="frostFree"
					defaultChecked={place?.frostFree ?? false}
					className="mt-1 h-4 w-4"
				/>
				<span>
					Never frosts
					<span className="block text-ink-soft text-xs">
						True of a hothouse, and of anything else properly under cover.
					</span>
				</span>
			</label>

			<Field
				label="Runs ahead of the open garden by"
				hint="Shifts every window that doesn't already name this place. Sow a month earlier inside, and figgy will ask a month earlier."
			>
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
								? `${plural(Math.abs(shift), 'month', 'months')} earlier`
								: `${plural(shift, 'month', 'months')} later`}
					</span>
				</span>
			</Field>

			<details open={Boolean(place?.widthCm || place?.lengthCm)}>
				<summary className="inline-flex min-h-tap cursor-pointer list-none items-center gap-1 text-ink-soft text-sm hover:text-palace-700">
					<Icon name="pencil" className="h-4 w-4" />
					Measurements
				</summary>
				<div className="grid grid-cols-2 gap-3">
					<Field label="Width, cm">
						<input
							name="widthCm"
							type="number"
							inputMode="numeric"
							min={1}
							defaultValue={place?.widthCm ?? ''}
							className={inputClass}
						/>
					</Field>
					<Field label="Length, cm">
						<input
							name="lengthCm"
							type="number"
							inputMode="numeric"
							min={1}
							defaultValue={place?.lengthCm ?? ''}
							className={inputClass}
						/>
					</Field>
				</div>
			</details>

			<Field label="Notes">
				<textarea
					name="notes"
					rows={2}
					defaultValue={place?.notes ?? ''}
					className={textareaClass}
				/>
			</Field>

			<div className="flex flex-wrap items-center gap-3">
				<Button type="submit" pending={pending} pendingLabel="Saving">
					{place ? 'Save' : 'Add it'}
				</Button>
				{state && !state.ok && (
					<span role="alert" className="text-prune-deep text-sm">
						{state.error}
					</span>
				)}
				{state?.ok && (
					<span className="inline-flex items-center gap-1 text-fertilise-deep text-sm">
						<Icon name="check" className="h-4 w-4" />
						Saved.
					</span>
				)}
			</div>
		</form>
	);
}

/**
 * Taking a place out of the garden, behind a second press - the same shape as
 * removing someone from the household.
 */
export function RemovePlace({ id, name }: { id: number; name: string }) {
	const [state, formAction, pending] = useActionState(removePlace, null);
	return (
		<div className="space-y-1">
			<details>
				<summary className="inline-flex min-h-tap cursor-pointer items-center text-ink-soft text-sm underline hover:text-prune-deep">
					Remove
				</summary>
				<form action={formAction}>
					<input type="hidden" name="environmentId" value={id} />
					<Button
						type="submit"
						variant="danger"
						pending={pending}
						pendingLabel="Removing"
						className="min-h-tap"
					>
						Remove {name}
					</Button>
				</form>
			</details>
			{state && !state.ok && (
				<p role="alert" className="text-prune-deep text-sm">
					{state.error}
				</p>
			)}
		</div>
	);
}
