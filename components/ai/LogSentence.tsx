'use client';

import { useActionState, useEffect, useState } from 'react';
import { commitLog, parseLog } from '@/actions/log';
import { ActionChip } from '@/components/ui/ActionChip';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { textareaClass } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import type { ParsedEntry } from '@/lib/ai/parse-log';
import type { IsoDate } from '@/lib/dates';

const CONFIDENCE_CLASS: Record<string, string> = {
	high: 'bg-fertilise-soft text-ink',
	medium: 'bg-palace-100 text-palace-700',
	low: 'bg-prune-soft text-ink',
};

type Draft = ParsedEntry & { keep: boolean };

/**
 * Say what you did; check what figgy understood; commit.
 *
 * The middle step is the point. Dictating on a phone with dirty hands is the
 * fast way in, and a sheet you glance at is what makes it safe - nothing is
 * written until it is right, and anything Claude could not match to a plant
 * cannot be committed at all.
 *
 * Shut until asked for. What's on is a board of jobs, and a textarea sitting
 * open above it took the top of the page - and the whole right-hand column
 * with it - to offer something you use once a visit.
 */
export function LogSentence({
	available,
	today,
}: {
	available: boolean;
	today: IsoDate;
}) {
	const [parseState, parseAction, parsing] = useActionState(parseLog, null);
	const [commitState, commitAction, committing] = useActionState(commitLog, null);
	const [drafts, setDrafts] = useState<Draft[]>([]);
	const [open, setOpen] = useState(false);

	// The parse lands in state so editing it survives the commit round trip:
	// React resets a form once its action has run.
	useEffect(() => {
		if (parseState?.ok) {
			setDrafts(
				parseState.parsed.entries.map((entry) => ({
					...entry,
					keep: entry.plantingId > 0,
				})),
			);
		}
	}, [parseState]);

	useEffect(() => {
		if (commitState?.ok) setDrafts([]);
	}, [commitState]);

	const keeping = drafts.filter((d) => d.keep);

	if (!open) {
		return (
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<Button
					variant="add"
					onClick={() => setOpen(true)}
					className="gap-2"
					aria-expanded={false}
				>
					<Icon name="pencil" className="h-4 w-4" />
					Add a note
				</Button>
				{commitState?.ok ? (
					<span className="flex items-center gap-1.5 text-ink-soft text-sm">
						<Icon name="check" className="h-4 w-4 text-fertilise" />
						Recorded {commitState.written}{' '}
						{commitState.written === 1 ? 'thing' : 'things'}.
					</span>
				) : (
					// The button says enough on a phone, where this wrapped to two
					// lines and cost more of the board than it explained.
					<span className="hidden text-ink-soft text-sm sm:inline">
						Say what you did and figgy will work out what to record.
					</span>
				)}
			</div>
		);
	}

	return (
		<Card
			tone="note"
			title="What did you do?"
			icon={<Icon name="pencil" className="h-[1.05em] w-[1.05em]" />}
			aside={
				<button
					type="button"
					onClick={() => setOpen(false)}
					title="Close"
					aria-label="Close"
					className="-m-1 rounded-md p-1 text-ink-faint hover:text-palace-700"
				>
					<Icon name="close" className="h-4 w-4" />
				</button>
			}
		>
			{!available ? (
				<EmptyState>
					figgy can turn &ldquo;netted the cherries and picked 2 kg of lemons&rdquo;
					into records, but it needs an Anthropic API key. Set{' '}
					<code>ANTHROPIC_API_KEY</code> and restart. You can always tick things off
					by hand.
				</EmptyState>
			) : (
				<div className="space-y-3">
					<form action={parseAction} className="space-y-2">
						<textarea
							name="sentence"
							rows={2}
							// biome-ignore lint/a11y/noAutofocus: the panel only exists because it was just asked for
							autoFocus
							aria-label="What did you do?"
							placeholder="netted the cherries and picked about 2 kg off the lemon"
							className={textareaClass}
						/>
						<div className="flex flex-wrap items-center gap-3">
							<Button type="submit" pending={parsing} pendingLabel="Reading…">
								Work it out
							</Button>
							<span className="text-ink-soft text-xs">
								Dictation works. Nothing is saved until you say so.
							</span>
							{parseState && !parseState.ok && (
								<span className="text-prune text-sm">{parseState.error}</span>
							)}
						</div>
					</form>

					{commitState?.ok && (
						<p className="flex items-center gap-1.5 rounded-md border border-fertilise/40 bg-fertilise-soft p-2 text-sm">
							<Icon name="check" className="h-4 w-4 text-fertilise" />
							Recorded {commitState.written}{' '}
							{commitState.written === 1 ? 'thing' : 'things'}.
						</p>
					)}

					{drafts.length > 0 && (
						// One step in, on the paper the panel is written on.
						<div className="space-y-3 rounded-md border border-rule bg-paper p-3">
							<p className="font-medium text-sm">
								Here is what figgy understood. Nothing is saved yet.
							</p>

							<ul className="space-y-2">
								{drafts.map((draft, index) => (
									<li
										// biome-ignore lint/suspicious/noArrayIndexKey: the parsed list is never reordered or filtered - only `keep` toggles - so position is stable
										key={`${draft.subject}-${draft.action}-${index}`}
										className={`rounded-md border p-2 ${
											draft.plantingId === 0
												? 'border-prune/40 bg-prune-soft'
												: draft.keep
													? 'border-rule bg-paper'
													: 'border-rule border-dashed bg-paper-sunk opacity-60'
										}`}
									>
										<div className="flex flex-wrap items-center gap-2">
											<input
												type="checkbox"
												checked={draft.keep}
												disabled={draft.plantingId === 0}
												onChange={() =>
													setDrafts((current) =>
														current.map((d, i) =>
															i === index ? { ...d, keep: !d.keep } : d,
														),
													)
												}
												className="h-5 w-5 shrink-0"
											/>
											<ActionChip action={draft.action} />
											<span className="font-medium text-sm">{draft.subject}</span>
											<input
												type="date"
												value={draft.completedOn}
												max={today}
												onChange={(e) =>
													setDrafts((current) =>
														current.map((d, i) =>
															i === index
																? { ...d, completedOn: e.target.value }
																: d,
														),
													)
												}
												className="min-h-tap rounded-md border border-rule bg-paper px-2 text-ink text-sm"
											/>
											{draft.quantity && (
												<span className="rounded-full bg-harvest-soft px-2 py-0.5 text-xs">
													{draft.quantity}
												</span>
											)}
											<span
												className={`ml-auto rounded-full px-2 py-0.5 text-xs ${CONFIDENCE_CLASS[draft.confidence]}`}
											>
												{draft.confidence}
											</span>
										</div>
										{draft.note && (
											<p className="mt-1 text-ink-soft text-xs">{draft.note}</p>
										)}
										{draft.plantingId === 0 && (
											<p className="mt-1 text-xs">
												figgy could not tell which plant this was, so it cannot be
												recorded. Tick it off by hand instead.
											</p>
										)}
									</li>
								))}
							</ul>

							{parseState?.ok && parseState.parsed.unclear.length > 0 && (
								<p className="text-ink-soft text-xs">
									Not understood: {parseState.parsed.unclear.join('; ')}
								</p>
							)}

							<form action={commitAction} className="flex items-center gap-3">
								<input
									type="hidden"
									name="entries"
									value={JSON.stringify(
										keeping.map((d) => ({
											plantingId: d.plantingId,
											action: d.action,
											completedOn: d.completedOn,
											quantity: d.quantity,
											note: d.note,
										})),
									)}
								/>
								<Button
									type="submit"
									disabled={keeping.length === 0}
									pending={committing}
									pendingLabel="Saving"
								>
									{`Record ${keeping.length} ${keeping.length === 1 ? 'thing' : 'things'}`}
								</Button>
								<button
									type="button"
									onClick={() => setDrafts([])}
									className="text-ink-soft text-sm underline"
								>
									Discard
								</button>
								{commitState && !commitState.ok && (
									<span className="text-prune text-sm">{commitState.error}</span>
								)}
							</form>
						</div>
					)}
				</div>
			)}
		</Card>
	);
}
