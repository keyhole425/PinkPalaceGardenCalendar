'use client';

import { useActionState } from 'react';
import { completeTask, undoCompletion } from '@/actions/care';
import { Button } from '@/components/ui/Button';
import { Field, inputClass, textareaClass } from '@/components/ui/Field';
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

			<Button
				type="submit"
				variant={quiet ? 'quiet' : 'primary'}
				size={quiet ? 'sm' : undefined}
				pending={pending}
				pendingLabel="Saving"
			>
				{label}
			</Button>

			{/*
			 * Kept to one line: in a task card this sits in a narrow column
			 * beside the job, and "another day, or a note" wrapped to two.
			 */}
			<details className="mt-1 text-left">
				<summary className="cursor-pointer list-none text-ink-soft text-xs underline">
					or&hellip;
				</summary>
				<div className="mt-2 space-y-2">
					<Field label="Done on" className="text-xs">
						<input
							type="date"
							name="completedOn"
							defaultValue={today}
							max={today}
							className={inputClass}
						/>
					</Field>
					<Field label="Note" className="text-xs">
						<textarea
							name="notes"
							rows={2}
							placeholder="How did it go?"
							className={textareaClass}
						/>
					</Field>
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
			<Button
				type="submit"
				variant="quiet"
				size="sm"
				pending={pending}
				pendingLabel="Undoing"
			>
				{label}
			</Button>
			{state && !state.ok && (
				<span className="ml-2 text-prune text-xs">{state.error}</span>
			)}
		</form>
	);
}
