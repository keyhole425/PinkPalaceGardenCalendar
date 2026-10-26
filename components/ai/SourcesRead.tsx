import type { Citation } from '@/lib/ai/schema';
import { hostOf } from '@/lib/ui/hostOf';
import { Prose } from './Prose';

/**
 * Every page Claude read for a look-up, and the notes it made. Shown while the
 * proposal is waiting for review and kept after it is accepted, because that
 * is where a looked-up plant's "see the pages it read" lands.
 */
export function SourcesRead({
	citations,
	notes,
	open = false,
}: {
	citations: Citation[];
	notes: string | null;
	open?: boolean;
}) {
	return (
		<details className="rounded-md border border-rule p-3" open={open}>
			<summary className="cursor-pointer text-ink-soft text-sm">
				Every page Claude read ({citations.length}), and its notes
			</summary>
			<ul className="mt-2 space-y-1 text-sm">
				{citations.map((c) => (
					<li key={c.url}>
						<a
							href={c.url}
							target="_blank"
							rel="noreferrer noopener"
							className="underline hover:text-palace-700"
						>
							{c.title}
						</a>
						<span className="ml-2 text-ink-soft text-xs">{hostOf(c.url)}</span>
					</li>
				))}
			</ul>
			{notes && (
				<div className="mt-3 border-rule border-t pt-3 text-ink-soft text-xs">
					<Prose text={notes} />
				</div>
			)}
		</details>
	);
}
