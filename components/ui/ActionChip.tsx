import type { CareAction } from '@/lib/db/schema';
import { actionChip, actionLabel } from '@/lib/ui/actions';

/** A care action, named and coloured. The most-reused piece in figgy. */
export function ActionChip({ action }: { action: CareAction | string }) {
	return (
		<span
			className={`inline-block shrink-0 rounded-sm px-2 py-1 font-medium text-xs ${actionChip(action)}`}
		>
			{actionLabel(action)}
		</span>
	);
}
