import { cx } from '@/lib/ui/cx';

export type CalloutTone = 'note' | 'good' | 'warn' | 'quiet';

const TONE: Record<CalloutTone, string> = {
	note: 'border-palace-300 border-l-4 bg-palace-50 py-2 pl-3 pr-3',
	good: 'rounded-md border border-fertilise/40 bg-fertilise-soft p-3',
	warn: 'rounded-md border border-prune/40 bg-prune-soft p-3',
	quiet: 'rounded-md border border-rule bg-paper-sunk p-3',
};

/** Something figgy wants to say about what you are looking at. */
export function Callout({
	tone = 'note',
	className,
	children,
}: {
	tone?: CalloutTone;
	className?: string;
	children: React.ReactNode;
}) {
	return <div className={cx('text-sm', TONE[tone], className)}>{children}</div>;
}
