import { cx } from '@/lib/ui/cx';

export type CardTone = 'plain' | 'alert' | 'sunk' | 'note';

const TONE: Record<CardTone, string> = {
	plain: '',
	alert: '',
	sunk: 'rounded-md border border-rule bg-paper-sunk p-3',
	note: 'rounded-md border border-palace-300 bg-palace-50 p-3',
};

/**
 * A titled block of a page.
 *
 * Renders a real <section> with a real <h2>, because that is what the page
 * reads like to a screen reader and to the e2e suite. `as="form"` makes the
 * card itself the form rather than a wrapper around one - SowForm is a card
 * and a form at the same time, and nesting them breaks its field lookups.
 */
export function Card({
	as = 'section',
	title,
	icon,
	count,
	tone = 'plain',
	aside,
	className,
	children,
	...rest
}: {
	as?: 'section' | 'form' | 'div';
	title?: string;
	/** Sits before the title, at the title's own size. Decoration only. */
	icon?: React.ReactNode;
	/** Shown next to the title, in the quiet weight. */
	count?: number;
	tone?: CardTone;
	/** The right-hand side of the heading row. */
	aside?: React.ReactNode;
	className?: string;
	children: React.ReactNode;
} & React.FormHTMLAttributes<HTMLFormElement>) {
	// A section, a div or a form, so `as="form"` can carry a server action.
	const Tag = as as React.ElementType;
	return (
		<Tag {...rest} className={cx('space-y-2', TONE[tone], className)}>
			{title && (
				<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<h2 className="flex items-baseline gap-2 font-semibold font-serif text-lg">
						{icon && (
							// Baseline-aligned rows and glyphs do not mix; centre the one
							// item that has no baseline of its own.
							<span className="self-center text-ink-soft">{icon}</span>
						)}
						<span className={tone === 'alert' ? 'text-prune-deep' : undefined}>
							{title}
						</span>
						{count !== undefined && (
							<span className="font-normal font-sans text-ink-soft text-sm tabular-nums">
								{count}
							</span>
						)}
					</h2>
					{aside && <div className="shrink-0">{aside}</div>}
				</div>
			)}
			{children}
		</Tag>
	);
}
