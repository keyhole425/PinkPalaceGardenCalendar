'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/lib/ui/cx';

/**
 * A nav tab that knows whether you are on it.
 *
 * Client-side because the App Router gives a server component no supported way
 * to read the current path. Middleware could inject one, but it would not
 * update on a soft navigation - the tab would lag every click. Thirty lines
 * here keeps the layout and all eleven pages on the server.
 */
export function NavLink({
	href,
	children,
	className,
}: {
	href: string;
	children: React.ReactNode;
	className?: string;
}) {
	const pathname = usePathname();
	const active = pathname === href || pathname.startsWith(`${href}/`);

	return (
		<Link
			href={href}
			aria-current={active ? 'page' : undefined}
			className={cx(
				'-mb-[9px] border-b-2 pb-2 text-sm',
				active
					? 'border-palace-700 font-medium text-palace-700'
					: 'border-transparent text-ink hover:text-palace-700',
				className,
			)}
		>
			{children}
		</Link>
	);
}

/** The same idea, sized for a thumb at the bottom of a phone. */
export function TabLink({
	href,
	children,
}: {
	href: string;
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const active = pathname === href || pathname.startsWith(`${href}/`);

	return (
		<Link
			href={href}
			aria-current={active ? 'page' : undefined}
			className={cx(
				'flex min-h-tap flex-1 items-center justify-center text-sm',
				active ? 'font-medium text-palace-700' : 'text-ink-soft',
			)}
		>
			{children}
		</Link>
	);
}
