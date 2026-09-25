'use client';

import { useActionState } from 'react';
import { completeTask, undoCompletion } from '@/actions/care';
import type { IsoDate } from '@/lib/dates';

/**
 * One tap marks the job done today. Everything else - a different date, a note
 * about how it went - is behind a disclosure, so the common case stays a
 * single thumb-sized target and the form still works without JavaScript.
 */
export function DoneForm({
	plantingId,
	ruleId,
	occurrenceKey,
	today,
	label = 'Done',
	quiet = false,
}: {
	plantingId: number;
	ruleId: number;
	occurrenceKey: string;
	today: IsoDate;
	label?: string;
	/** For backfilling old history, where a big pink button would be noise. */
	quiet?: boolean;
}) {
	const [state, formAction, pending] = useActionState(completeTask, null);

	return (
		<form action={formAction} className="shrink-0 text-right">
			<input type="hidden" name="plantingId" value={plantingId} />
			<input type="hidden" name="ruleId" value={ruleId} />
			<input type="hidden" name="occurrenceKey" value={occurrenceKey} />

			<button
				type="submit"
				disabled={pending}
				className={
					quiet
						? 'text-ink-soft text-xs underline hover:text-palace-700 disabled:opacity-50'
						: 'min-h-11 rounded-md bg-palace-200 px-4 font-medium text-palace-700 text-sm hover:bg-palace-300 disabled:opacity-50'
				}
			>
				{pending ? 'Saving' : label}
			</button>

			<details className="mt-1 text-left">
				<summary className="cursor-pointer list-none text-ink-soft text-xs underline">
					another day, or a note
				</summary>
				<div className="mt-2 space-y-2">
					<label className="block text-ink-soft text-xs">
						Done on
						<input
							type="date"
							name="completedOn"
							defaultValue={today}
							max={today}
							className="mt-0.5 block min-h-11 w-full rounded-md border border-rule px-2 text-ink text-sm"
						/>
					</label>
					<label className="block text-ink-soft text-xs">
						Note
						<textarea
							name="notes"
							rows={2}
							placeholder="How did it go?"
							className="mt-0.5 block w-full rounded-md border border-rule px-2 py-1 text-ink text-sm"
						/>
					</label>
				</div>
			</details>

			{state && !state.ok && (
				<p className="mt-1 text-prune text-xs">{state.error}</p>
			)}
		</form>
	);
}

export function UndoButton({
	logId,
	slug,
	label = 'Undo',
}: {
	logId: number;
	slug?: string;
	label?: string;
}) {
	const [state, formAction, pending] = useActionState(undoCompletion, null);

	return (
		<form action={formAction} className="inline">
			<input type="hidden" name="logId" value={logId} />
			{slug && <input type="hidden" name="slug" value={slug} />}
			<button
				type="submit"
				disabled={pending}
				className="text-ink-soft text-xs underline hover:text-palace-700 disabled:opacity-50"
			>
				{pending ? 'Undoing' : label}
			</button>
			{state && !state.ok && (
				<span className="ml-2 text-prune text-xs">{state.error}</span>
			)}
		</form>
	);
}
