import { cx } from '@/lib/ui/cx';

export type Tone = 'palace' | 'strong' | 'quiet' | 'good' | 'warn' | 'harvest';

const TONE: Record<Tone, string> = {
	palace: 'bg-palace-100 text-palace-700',
	strong: 'bg-palace-200 text-palace-700',
	quiet: 'bg-paper-sunk text-ink-soft',
	good: 'bg-fertilise-soft text-ink',
	warn: 'bg-prune-soft text-ink',
	harvest: 'bg-harvest-soft text-ink',
};

/** A small ring of colour against a word. Never pressable - see Button. */
export function Badge({
	tone = 'palace',
	title,
	className,
	children,
}: {
	tone?: Tone;
	title?: string;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<span
			title={title}
			className={cx(
				'inline-block rounded-full px-2 py-0.5 text-xs',
				TONE[tone],
				className,
			)}
		>
			{children}
		</span>
	);
}
