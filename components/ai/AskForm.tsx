'use client';

import { useActionState } from 'react';
import { askAboutPlant } from '@/actions/research';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Looking something up costs real money and takes the better part of a minute,
 * so the button says what it is about to do rather than pretending to be free.
 */
export function AskForm({
	available,
	plantTypeId,
	defaultQuery,
	label = 'Look it up',
	placeholder = 'Kaffir lime',
}: {
	available: boolean;
	plantTypeId?: number;
	defaultQuery?: string;
	label?: string;
	placeholder?: string;
}) {
	const [state, formAction, pending] = useActionState(askAboutPlant, null);

	if (!available) {
		return (
			<EmptyState>
				figgy can research a plant&rsquo;s care for Adelaide and propose a schedule,
				but it needs an Anthropic API key to do it. Set{' '}
				<code>ANTHROPIC_API_KEY</code> and restart. Everything else works without
				one.
			</EmptyState>
		);
	}

	return (
		<form
			action={formAction}
			className="space-y-2 rounded-md border border-palace-300 bg-palace-50 p-3"
		>
			{plantTypeId && (
				<input type="hidden" name="plantTypeId" value={plantTypeId} />
			)}
			<div className="flex flex-wrap items-end gap-2">
				<label className="text-ink-soft text-sm">
					Plant
					<input
						name="query"
						required
						defaultValue={defaultQuery}
						placeholder={placeholder}
						className="mt-0.5 block min-h-tap w-56 rounded-md border border-rule bg-paper px-2 text-ink"
					/>
				</label>
				<Button type="submit" pending={pending} pendingLabel="Reading around…">
					{label}
				</Button>
			</div>
			<p className="text-ink-soft text-xs">
				Claude searches for local advice, then proposes a month-by-month schedule
				with its sources. Nothing is saved until you accept it. Takes about a minute
				and costs roughly 20&ndash;40 cents.
			</p>
			{state && !state.ok && <p className="text-prune text-sm">{state.error}</p>}
		</form>
	);
}
