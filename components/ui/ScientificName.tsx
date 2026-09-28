import { cx } from '@/lib/ui/cx';

/**
 * A botanical binomial: Prunus domestica, Citrus limon.
 *
 * Italic is the convention for a species name, and figgy sets it in the
 * serif - the one place Fraunces appears outside a heading. A reference book
 * would do the same, and it draws the line the page is really making: the
 * name of the species, not the name you call the tree in the garden.
 *
 * <em> rather than <i>, because this is a shift in kind of language and not
 * only in appearance.
 */
export function ScientificName({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return <em className={cx('font-serif', className)}>{children}</em>;
}
