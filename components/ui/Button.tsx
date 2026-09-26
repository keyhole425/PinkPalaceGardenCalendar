'use client';

import Link from 'next/link';
import { cx } from '@/lib/ui/cx';

export type Variant = 'primary' | 'quiet' | 'danger' | 'add' | 'pill';

/**
 * Complete class strings, because Tailwind scans source text and a name built
 * at runtime never compiles. Before this map existed the primary button was
 * copy-pasted into fourteen files and five of them had lost their text-sm.
 */
const VARIANT: Record<Variant, string> = {
	primary:
		'inline-flex min-h-tap items-center justify-center rounded-md bg-palace-200 px-4 font-medium text-palace-700 text-sm hover:bg-palace-300 disabled:opacity-50',
	quiet:
		'text-ink-soft text-sm underline hover:text-palace-700 disabled:opacity-50',
	danger: 'text-ink-soft text-sm underline hover:text-prune disabled:opacity-50',
	add: 'inline-flex min-h-tap items-center justify-center rounded-md border border-palace-300 border-dashed px-4 text-palace-700 text-sm hover:bg-palace-50',
	pill: 'rounded-full bg-palace-100 px-3 py-1 text-palace-700 text-sm hover:bg-palace-200',
};

const SMALL: Partial<Record<Variant, string>> = {
	quiet:
		'text-ink-soft text-xs underline hover:text-palace-700 disabled:opacity-50',
	danger: 'text-ink-soft text-xs underline hover:text-prune disabled:opacity-50',
};

function classesFor(variant: Variant, size?: 'sm', className?: string) {
	const base = (size === 'sm' && SMALL[variant]) || VARIANT[variant];
	return cx(base, className);
}

export function Button({
	variant = 'primary',
	size,
	pending = false,
	pendingLabel,
	className,
	children,
	...rest
}: {
	variant?: Variant;
	size?: 'sm';
	/** Disables and swaps the label while a server action is in flight. */
	pending?: boolean;
	pendingLabel?: string;
	className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type={rest.type ?? 'button'}
			{...rest}
			disabled={rest.disabled || pending}
			className={classesFor(variant, size, className)}
		>
			{pending && pendingLabel ? pendingLabel : children}
		</button>
	);
}

export function ButtonLink({
	variant = 'primary',
	size,
	href,
	className,
	children,
	...rest
}: {
	variant?: Variant;
	size?: 'sm';
	href: string;
	className?: string;
	children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, 'href' | 'className'>) {
	return (
		<Link {...rest} href={href} className={classesFor(variant, size, className)}>
			{children}
		</Link>
	);
}
