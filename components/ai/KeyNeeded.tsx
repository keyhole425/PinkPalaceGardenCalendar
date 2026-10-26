import Link from 'next/link';

/**
 * The second half of every "Claude is switched off" sentence: who can switch
 * it on, and where. figgy has no key of its own; a household brings one.
 */
export function KeyNeeded({ canAddKey }: { canAddKey: boolean }) {
	return canAddKey ? (
		<>
			Add your household&rsquo;s Anthropic key under{' '}
			<Link href="/settings#looking-things-up" className="underline">
				Settings
			</Link>
			.
		</>
	) : (
		<>An admin of your household can add an Anthropic key in Settings.</>
	);
}
