import { cx } from '@/lib/ui/cx';

/** Nothing here yet, said in the same voice everywhere. */
export function EmptyState({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<p
			className={cx(
				'rounded-md border border-rule border-dashed p-3 text-ink-soft text-sm',
				className,
			)}
		>
			{children}
		</p>
	);
}
