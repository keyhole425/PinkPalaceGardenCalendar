'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { completeTask, undoCompletion } from '@/actions/care';
import { Button } from '@/components/ui/Button';
import { textareaClass } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { formatLong, type IsoDate, plusDays } from '@/lib/dates';

/**
 * One tap marks the job done today. Everything else - a different date, a note
 * about how it went - is behind a disclosure, so the common case stays a
 * single thumb-sized target and the form still works without JavaScript.
 *
 * The disclosure used to read "or..." in the narrow column beside the button,
 * which said nothing about what was behind it. It now says what it does and
 * opens over the page rather than inside a 96px column, because a date field
 * and a note need more room than that and a card has none to give.
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
	const panel = useRef<HTMLDetailsElement>(null);
	// Controlled so the two shortcuts can set it. Without JavaScript it is
	// still a date input with today in it, which is the whole job.
	const [doneOn, setDoneOn] = useState<IsoDate>(today);

	const yesterday = plusDays(today, -1);

	// A failed save is the one thing the panel has to stay open for.
	useEffect(() => {
		if (state?.ok && panel.current) panel.current.open = false;
	}, [state]);

	const shortcut = (date: IsoDate, text: string) => (
		<button
			type="button"
			onClick={() => setDoneOn(date)}
			aria-pressed={doneOn === date}
			className={`min-h-8 rounded-md border px-2 text-xs ${
				doneOn === date
					? 'border-palace-500 bg-palace-200 font-medium text-palace-700'
					: 'border-rule bg-paper text-ink-soft hover:border-palace-300'
			}`}
		>
			{text}
		</button>
	);

	return (
		<form action={formAction} className="relative shrink-0 text-right">
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

			<details ref={panel} className="group mt-1 text-left">
				<summary
					// Right-aligned under the button it belongs to, and a real
					// target: the old one was eleven pixels of underlined text.
					className="flex min-h-7 cursor-pointer list-none items-center justify-end gap-1 py-0.5 text-ink-soft text-xs hover:text-palace-700"
				>
					<Icon name="pencil" className="h-3 w-3" />
					<span className="underline decoration-dotted underline-offset-2">
						Date or note
					</span>
				</summary>

				{/*
				 * Over the card, not inside it. Anchored to the button's right
				 * edge so it opens back across the row it belongs to, and given
				 * the notebook's own "this is a note" wash so it reads as a slip
				 * of paper laid on top rather than another region of the card.
				 */}
				<div className="absolute right-0 z-20 mt-1 w-64 max-w-[calc(100vw-2.5rem)] space-y-3 rounded-md border border-palace-300 bg-palace-50 p-3">
					<div className="flex items-start justify-between gap-2">
						<div>
							<p className="font-medium text-ink text-sm">Record it differently</p>
							<p className="text-ink-soft text-xs">
								Back-date it, or say how it went.
							</p>
						</div>
						<button
							type="button"
							onClick={() => {
								if (panel.current) panel.current.open = false;
							}}
							title="Close"
							aria-label="Close"
							className="-m-1 shrink-0 rounded-md p-1 text-ink-faint hover:text-palace-700"
						>
							<Icon name="close" className="h-4 w-4" />
						</button>
					</div>

					<div className="space-y-1.5">
						<p className="flex items-center gap-1.5 font-medium text-ink-soft text-xs">
							<Icon name="calendar" className="h-3.5 w-3.5" />
							Done on
						</p>
						<div className="flex flex-wrap gap-1.5">
							{shortcut(today, 'Today')}
							{shortcut(yesterday, 'Yesterday')}
						</div>
						<input
							type="date"
							name="completedOn"
							value={doneOn}
							max={today}
							onChange={(e) => setDoneOn(e.target.value)}
							className="block min-h-9 w-full rounded-md border border-rule bg-paper px-2 text-ink text-sm"
						/>
						<p className="text-ink-faint text-2xs">{formatLong(doneOn)}</p>
					</div>

					<div className="space-y-1.5">
						<p className="flex items-center gap-1.5 font-medium text-ink-soft text-xs">
							<Icon name="pencil" className="h-3.5 w-3.5" />
							How did it go?
						</p>
						<textarea
							name="notes"
							rows={3}
							placeholder="Took about an hour. Two branches still to do."
							className={textareaClass}
						/>
					</div>

					<div className="flex items-center justify-between gap-3">
						<Button
							type="submit"
							pending={pending}
							pendingLabel="Saving"
							className="grow"
						>
							Record it
						</Button>
						<button
							type="button"
							onClick={() => {
								if (panel.current) panel.current.open = false;
							}}
							className="shrink-0 text-ink-soft text-xs underline hover:text-palace-700"
						>
							Cancel
						</button>
					</div>
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
