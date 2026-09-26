'use client';

import { useActionState, useState } from 'react';
import { clearFromBed, sowInBed } from '@/actions/beds';
import { Button } from '@/components/ui/Button';
import type { IsoDate } from '@/lib/dates';

export type SowablePlant = {
	id: number;
	commonName: string;
	family: string | null;
	/** True when this month is inside the crop's sowing window here. */
	inSeason: boolean;
	/** True when the window moved because of where this is. */
	shifted: boolean;
};

export type RecentFamily = { family: string; what: string; when: string };

/**
 * Sowing something.
 *
 * Crops in season here are listed first, because in September you almost
 * certainly want one of those. The rotation warning arrives as a refusal you
 * can overrule - it is advice about soil, not a rule about data.
 */
export function SowForm({
	environmentId,
	plants,
	today,
	cols,
	rows,
	recentFamilies,
}: {
	environmentId: number;
	plants: SowablePlant[];
	today: IsoDate;
	cols: number;
	rows: number;
	/** Families grown here within the rotation window. */
	recentFamilies: RecentFamily[];
}) {
	const [state, formAction, pending] = useActionState(sowInBed, null);

	const inSeason = plants.filter((p) => p.inSeason);
	const rest = plants.filter((p) => !p.inSeason);

	// Controlled on purpose. The rotation warning comes back as a failed
	// submit, which re-renders the form - and an uncontrolled select loses
	// what you picked, so pressing "sow it anyway" would sow something else
	// entirely. Holding the choice in state means what you see is what goes in.
	const [choice, setChoice] = useState(
		String(inSeason[0]?.id ?? plants[0]?.id ?? ''),
	);
	const [posX, setPosX] = useState('0');
	const [posY, setPosY] = useState('0');
	const [sownOn, setSownOn] = useState(today);

	const chosen = plants.find((p) => String(p.id) === choice);
	// Said before you press the button, which is when it can still change your
	// mind. React resets a form after an action runs, so a warning that arrives
	// as a failed submit loses everything you had selected.
	const clash = chosen?.family
		? recentFamilies.find((r) => r.family === chosen.family)
		: undefined;

	return (
		<form
			action={formAction}
			className="space-y-3 rounded-md border border-rule bg-paper-sunk p-3"
		>
			<input type="hidden" name="environmentId" value={environmentId} />

			<div className="flex flex-wrap gap-3">
				<label className="text-ink-soft text-xs">
					What
					<select
						name="plantTypeId"
						value={choice}
						onChange={(e) => setChoice(e.target.value)}
						className="mt-0.5 block min-h-tap rounded-md border border-rule bg-paper px-2 text-ink text-sm"
					>
						{inSeason.length > 0 && (
							<optgroup label="In season now">
								{inSeason.map((p) => (
									<option key={p.id} value={p.id}>
										{p.commonName}
										{p.shifted ? ' (brought forward)' : ''}
									</option>
								))}
							</optgroup>
						)}
						<optgroup label="Out of season">
							{rest.map((p) => (
								<option key={p.id} value={p.id}>
									{p.commonName}
								</option>
							))}
						</optgroup>
					</select>
				</label>

				<label className="text-ink-soft text-xs">
					Where
					<select
						name="posX"
						value={posX}
						onChange={(e) => setPosX(e.target.value)}
						className="mt-0.5 block min-h-tap rounded-md border border-rule bg-paper px-2 text-ink text-sm"
					>
						{Array.from({ length: cols }, (_, x) => (
							<option key={x} value={x}>
								Column {x + 1}
							</option>
						))}
					</select>
				</label>

				<label className="text-ink-soft text-xs">
					Row
					<select
						name="posY"
						value={posY}
						onChange={(e) => setPosY(e.target.value)}
						className="mt-0.5 block min-h-tap rounded-md border border-rule bg-paper px-2 text-ink text-sm"
					>
						{Array.from({ length: rows }, (_, y) => (
							<option key={y} value={y}>
								Row {y + 1}
							</option>
						))}
					</select>
				</label>

				<label className="text-ink-soft text-xs">
					Sown
					<input
						type="date"
						name="sownOn"
						value={sownOn}
						onChange={(e) => setSownOn(e.target.value)}
						max={today}
						className="mt-0.5 block min-h-tap rounded-md border border-rule bg-paper px-2 text-ink text-sm"
					/>
				</label>
			</div>

			{clash && (
				<p className="rounded-md border border-prune/40 bg-prune-soft p-2 text-sm">
					{clash.what} ({clash.family}) was here {clash.when}. Same family two
					seasons running invites trouble &mdash; but it is your soil.
				</p>
			)}

			<div className="flex flex-wrap items-center gap-3">
				<Button type="submit" pending={pending} pendingLabel="Sowing">
					{clash ? 'Sow it anyway' : 'Sow'}
				</Button>
				{state && !state.ok && (
					<span className="text-prune text-sm">{state.error}</span>
				)}
				{state?.ok && state.warning && (
					<span className="text-ink-soft text-sm">{state.warning}</span>
				)}
				{state?.ok && !state.warning && (
					<span className="text-fertilise text-sm">Sown.</span>
				)}
			</div>
		</form>
	);
}

export function ClearButton({
	plantingId,
	slug,
}: {
	plantingId: number;
	slug: string;
}) {
	const [state, formAction, pending] = useActionState(clearFromBed, null);

	return (
		<form action={formAction} className="inline">
			<input type="hidden" name="plantingId" value={plantingId} />
			<input type="hidden" name="slug" value={slug} />
			<button
				type="submit"
				disabled={pending}
				className="text-ink-soft text-sm underline hover:text-palace-700 disabled:opacity-50"
				title="Frees the spot. The record stays."
			>
				{pending ? '…' : 'Clear'}
			</button>
			{state && !state.ok && (
				<span className="ml-2 text-prune text-xs">{state.error}</span>
			)}
		</form>
	);
}
