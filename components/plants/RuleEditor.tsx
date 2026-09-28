'use client';

import { useActionState, useState } from 'react';
import { deleteRule, saveRule } from '@/actions/rules';
import { Button } from '@/components/ui/Button';
import { CADENCES, CARE_ACTIONS } from '@/lib/db/schema';
import {
	type Month,
	monthAbbr,
	monthName,
	monthsFromMask,
	monthsInOrder,
} from '@/lib/schedule/months';
import { ACTION_LABEL } from '@/lib/ui/actions';

const CADENCE_LABEL: Record<string, string> = {
	monthly: 'Every month it names',
	once_in_window: 'Once, any time in the window',
	continuous: 'A season, not a job (harvest)',
};

const ENVIRONMENT_LABEL: Record<string, string> = {
	'': 'Anywhere',
	orchard: 'Only in the orchard',
	bed: 'Only in a bed',
	hothouse: 'Only in the hothouse',
	pot: 'Only in a pot',
};

export type EditableRule = {
	ruleIds: number[];
	action: string;
	monthMask: number;
	cadence: string;
	alternatives: boolean;
	environmentKind: string | null;
	note: string | null;
};

/**
 * Twelve buttons and a couple of choices.
 *
 * Months run July-first, the same as the year grid, so the shape you click is
 * the shape you already read. "One of these will do" is the spreadsheet's OR:
 * each month becomes an alternative and doing any one of them is enough.
 */
export function RuleEditor({
	plantTypeId,
	rule,
	onDone,
}: {
	plantTypeId: number;
	rule?: EditableRule;
	onDone?: () => void;
}) {
	const [saveState, saveAction, saving] = useActionState(saveRule, null);
	const [deleteState, deleteAction, deleting] = useActionState(deleteRule, null);

	const [months, setMonths] = useState<Set<Month>>(
		new Set(rule ? monthsFromMask(rule.monthMask) : []),
	);
	const [alternatives, setAlternatives] = useState(rule?.alternatives ?? false);
	const [cadence, setCadence] = useState(rule?.cadence ?? 'monthly');

	const toggle = (m: Month) => {
		setMonths((current) => {
			const next = new Set(current);
			if (next.has(m)) next.delete(m);
			else next.add(m);
			return next;
		});
	};

	const existing = rule?.ruleIds.join(',') ?? '';

	return (
		<div className="space-y-3 rounded-md border border-rule bg-paper-sunk p-3">
			<form action={saveAction} className="space-y-3">
				<input type="hidden" name="plantTypeId" value={plantTypeId} />
				<input type="hidden" name="replacing" value={existing} />
				{[...months].map((m) => (
					<input key={m} type="hidden" name="months" value={m} />
				))}

				<div className="flex flex-wrap gap-3">
					<label className="text-ink-soft text-xs">
						Action
						<select
							name="action"
							defaultValue={rule?.action ?? 'fertilise'}
							className="mt-0.5 block min-h-tap rounded-md border border-rule bg-paper px-2 text-ink text-sm"
						>
							{CARE_ACTIONS.filter((a) => a !== 'note').map((a) => (
								<option key={a} value={a}>
									{ACTION_LABEL[a] ?? a}
								</option>
							))}
						</select>
					</label>

					<label className="text-ink-soft text-xs">
						How often
						<select
							name="cadence"
							value={alternatives ? 'once_in_window' : cadence}
							disabled={alternatives}
							onChange={(e) => setCadence(e.target.value)}
							className="mt-0.5 block min-h-tap rounded-md border border-rule bg-paper px-2 text-ink text-sm disabled:opacity-60"
						>
							{CADENCES.map((c) => (
								<option key={c} value={c}>
									{CADENCE_LABEL[c]}
								</option>
							))}
						</select>
					</label>

					<label className="text-ink-soft text-xs">
						Where
						<select
							name="environmentKind"
							defaultValue={rule?.environmentKind ?? ''}
							className="mt-0.5 block min-h-tap rounded-md border border-rule bg-paper px-2 text-ink text-sm"
						>
							{Object.entries(ENVIRONMENT_LABEL).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</label>
				</div>

				<div>
					<p className="mb-1 text-ink-soft text-xs">Months</p>
					<div className="flex flex-wrap gap-1">
						{monthsInOrder(7).map((m) => {
							const on = months.has(m);
							return (
								<button
									key={m}
									type="button"
									onClick={() => toggle(m)}
									aria-pressed={on}
									title={monthName(m)}
									className={`min-h-tap w-12 rounded-md border text-sm ${
										on
											? 'border-palace-500 bg-palace-200 font-medium text-palace-700'
											: 'border-rule bg-paper text-ink-soft hover:bg-palace-50'
									}`}
								>
									{monthAbbr(m)}
								</button>
							);
						})}
					</div>
				</div>

				<label className="flex items-start gap-2 text-sm">
					<input
						type="checkbox"
						name="alternatives"
						checked={alternatives}
						onChange={(e) => setAlternatives(e.target.checked)}
						className="mt-1 h-4 w-4"
					/>
					<span>
						One of these months will do
						<span className="block text-ink-soft text-xs">
							The spreadsheet&rsquo;s <em>or</em> cells &mdash; pick a month and the
							job is done for the season.
						</span>
					</span>
				</label>

				<label className="block text-ink-soft text-xs">
					Note
					<input
						type="text"
						name="note"
						defaultValue={rule?.note ?? ''}
						placeholder="Light pruning only, 15-25%"
						className="mt-0.5 block w-full rounded-md border border-rule bg-paper px-2 py-2 text-ink text-sm"
					/>
				</label>

				<div className="flex flex-wrap items-center gap-2">
					<Button
						type="submit"
						disabled={months.size === 0}
						pending={saving}
						pendingLabel="Saving"
					>
						{rule ? 'Save' : 'Add rule'}
					</Button>
					{onDone && (
						<button
							type="button"
							onClick={onDone}
							className="text-ink-soft text-sm underline"
						>
							Cancel
						</button>
					)}
					{months.size === 0 && (
						<span className="text-ink-soft text-xs">
							Choose at least one month.
						</span>
					)}
					{saveState && !saveState.ok && (
						<span className="text-prune-deep text-xs">{saveState.error}</span>
					)}
					{saveState?.ok && (
						<span className="text-fertilise-deep text-xs">Saved.</span>
					)}
				</div>
			</form>

			{rule && (
				<form action={deleteAction} className="border-rule border-t pt-2">
					<input type="hidden" name="plantTypeId" value={plantTypeId} />
					<input type="hidden" name="replacing" value={existing} />
					<input type="hidden" name="action" value={rule.action} />
					<button
						type="submit"
						disabled={deleting}
						className="text-ink-soft text-xs underline hover:text-prune-deep disabled:opacity-50"
					>
						{deleting ? 'Removing' : 'Remove this rule'}
					</button>
					<span className="ml-2 text-ink-soft text-xs">
						Re-seeding won&rsquo;t bring it back.
					</span>
					{deleteState && !deleteState.ok && (
						<span className="ml-2 text-prune-deep text-xs">
							{deleteState.error}
						</span>
					)}
				</form>
			)}
		</div>
	);
}
