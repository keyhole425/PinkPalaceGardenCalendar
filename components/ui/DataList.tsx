import { cx } from '@/lib/ui/cx';

/**
 * A ruled list. The notebook's default way of showing several of anything.
 */
export function DataList({
	as = 'ul',
	className,
	children,
}: {
	as?: 'ul' | 'ol';
	className?: string;
	children: React.ReactNode;
}) {
	const Tag = as;
	return (
		<Tag
			className={cx(
				'divide-y divide-rule-faint rounded-md border border-rule',
				className,
			)}
		>
			{children}
		</Tag>
	);
}

export function DataRow({
	action,
	className,
	children,
}: {
	/** Pushed to the right of the row: an Edit link, a count, a button. */
	action?: React.ReactNode;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<li
			className={cx(
				'flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm',
				className,
			)}
		>
			{children}
			{action && <span className="ml-auto shrink-0">{action}</span>}
		</li>
	);
}
