'use client';

import { useActionState } from 'react';
import { addToGarden } from '@/actions/plants';
import { Button } from '@/components/ui/Button';

/** The article's one primary action. Success lands back on the page, ready to sow. */
export function AddToGarden({ slug }: { slug: string }) {
	const [state, formAction, pending] = useActionState(addToGarden, null);
	return (
		<form action={formAction} className="text-right">
			<input type="hidden" name="slug" value={slug} />
			<Button type="submit" pending={pending} pendingLabel="Adding">
				Add to my garden
			</Button>
			{state && !state.ok && (
				<p className="mt-1 max-w-56 text-prune-deep text-sm">{state.error}</p>
			)}
		</form>
	);
}
