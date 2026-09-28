import { Children } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * A group of jobs on What's on.
 *
 * Always a real <section> with a real heading, whether or not it is collapsed:
 * that is what the page reads like aloud, and what the e2e suite looks for.
 * `collapsible` folds the whole list down to its heading row, for the groups
 * that are worth knowing about but not worth scrolling past.
 */
export function Section({
	title,
	count,
	tone = 'plain',
	empty,
	collapsible = false,
	defaultOpen = false,
	max,
	children,
}: {
	title: string;
	count: number;
	tone?: 'plain' | 'alert';
	empty: string;
	collapsible?: boolean;
	defaultOpen?: boolean;
	/** Show this many, and fold the rest away. A due list can run to twenty. */
	max?: number;
	children: React.ReactNode;
}) {
	const heading = (
		<>
			<span className={tone === 'alert' ? 'text-prune-deep' : undefined}>
				{title}
			</span>
			<span className="font-normal font-sans text-ink-soft text-sm tabular-nums">
				{count}
			</span>
		</>
	);

	const items = Children.toArray(children);
	const shown = max ? items.slice(0, max) : items;
	const rest = max ? items.slice(max) : [];

	const body =
		count === 0 ? (
			<EmptyState>{empty}</EmptyState>
		) : (
			<>
				<ul className="space-y-2">{shown}</ul>
				{rest.length > 0 && (
					<details className="mt-2">
						<summary className="inline-flex min-h-tap cursor-pointer list-none items-center text-ink-soft text-sm underline hover:text-palace-700">
							Show the other {rest.length}
						</summary>
						<ul className="mt-2 space-y-2">{rest}</ul>
					</details>
				)}
			</>
		);

	if (collapsible) {
		return (
			<section>
				<details open={defaultOpen} className="group">
					<summary className="flex min-h-tap cursor-pointer list-none items-baseline gap-2 font-semibold font-serif text-lg marker:content-none">
						{heading}
						<span className="ml-1 font-normal font-sans text-ink-faint text-xs group-open:hidden">
							show
						</span>
						<span className="ml-1 hidden font-normal font-sans text-ink-faint text-xs group-open:inline">
							hide
						</span>
					</summary>
					<h2 className="sr-only">{title}</h2>
					<div className="pt-2">{body}</div>
				</details>
			</section>
		);
	}

	return (
		<section className="space-y-2">
			<h2 className="flex items-baseline gap-2 font-semibold font-serif text-lg">
				{heading}
			</h2>
			{body}
		</section>
	);
}
