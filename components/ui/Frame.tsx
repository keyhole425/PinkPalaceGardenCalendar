import { cx } from '@/lib/ui/cx';

/**
 * The width a page is allowed to take.
 *
 * The shell deliberately declares no content width of its own. A reading page
 * and a twelve-month table want very different things, and the old layout gave
 * both of them 1400px.
 */
export type Width = 'measure' | 'list' | 'page' | 'wide';

const WIDTH: Record<Width, string> = {
	measure: 'max-w-measure',
	list: 'max-w-list',
	page: 'max-w-page',
	wide: 'max-w-wide',
};

export function Frame({
	width = 'page',
	className,
	children,
}: {
	width?: Width;
	/** Layout only - margin, order, width. Never colour or type. */
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cx(
				'mx-auto w-full px-gutter lg:px-gutter-lg',
				WIDTH[width],
				className,
			)}
		>
			{children}
		</div>
	);
}
