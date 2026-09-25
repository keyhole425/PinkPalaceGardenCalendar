'use client';

import { useActionState } from 'react';
import { markReviewed } from '@/actions/plants';

export function ReviewedButton({ plantTypeId }: { plantTypeId: number }) {
	const [state, formAction, pending] = useActionState(markReviewed, null);

	return (
		<form action={formAction} className="inline">
			<input type="hidden" name="plantTypeId" value={plantTypeId} />
			<button
				type="submit"
				disabled={pending}
				className="min-h-11 rounded-md bg-palace-200 px-3 font-medium text-palace-700 text-sm hover:bg-palace-300 disabled:opacity-50"
			>
				{pending ? 'Saving' : 'This one is sorted'}
			</button>
			{state && !state.ok && (
				<span className="ml-2 text-prune text-xs">{state.error}</span>
			)}
		</form>
	);
}
