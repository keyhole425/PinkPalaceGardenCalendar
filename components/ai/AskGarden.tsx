'use client';

import { useActionState } from 'react';
import { ask } from '@/actions/ask';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { inputClass } from '@/components/ui/Field';
import { Prose } from './Prose';

const SUGGESTIONS = [
	'What should I sow this weekend?',
	'What did the fig give us last year?',
	'Which beds have had the same family twice?',
	'What have I not done to the lemon?',
];

export function AskGarden({ available }: { available: boolean }) {
	const [state, formAction, pending] = useActionState(ask, null);

	if (!available) {
		return (
			<EmptyState>
				figgy can answer questions about your own records, but it needs an Anthropic
				API key. Set <code>ANTHROPIC_API_KEY</code> and restart.
			</EmptyState>
		);
	}

	return (
		<div className="space-y-4">
			<form action={formAction} className="space-y-2">
				<label className="block text-ink-soft text-sm">
					Ask about your garden
					<input
						name="question"
						placeholder="What did the fig give us last year?"
						className={inputClass}
					/>
				</label>
				<div className="flex flex-wrap items-center gap-3">
					<Button type="submit" pending={pending} pendingLabel="Looking…">
						Ask
					</Button>
					<span className="text-ink-soft text-xs">
						Claude reads your records. It cannot change them.
					</span>
					{state && !state.ok && (
						<span className="text-prune text-sm">{state.error}</span>
					)}
				</div>
			</form>

			<div className="flex flex-wrap gap-2">
				{SUGGESTIONS.map((suggestion) => (
					<form key={suggestion} action={formAction}>
						<input type="hidden" name="question" value={suggestion} />
						<button
							type="submit"
							disabled={pending}
							className="rounded-full border border-rule px-3 py-1 text-ink-soft text-xs hover:bg-palace-50 disabled:opacity-50"
						>
							{suggestion}
						</button>
					</form>
				))}
			</div>

			{state?.ok && (
				<div className="space-y-2 rounded-md border border-palace-300 bg-palace-50 p-3">
					<p className="font-medium text-sm">{state.question}</p>
					<div className="text-sm">
						<Prose text={state.answer} />
					</div>
					{state.toolsUsed.length > 0 && (
						<p className="text-ink-soft text-xs">
							Read: {state.toolsUsed.join(', ').replaceAll('_', ' ')}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
