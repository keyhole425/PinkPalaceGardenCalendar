import Link from 'next/link';

/**
 * The top of every page: an optional line above, a title, a sentence of
 * explanation, and whatever you can do from here.
 *
 * The description carries its own reading measure. Left to itself it would run
 * the full width of the page, which is most of why figgy used to feel stretched.
 */
export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
	back,
}: {
	eyebrow?: React.ReactNode;
	title: string;
	description?: React.ReactNode;
	actions?: React.ReactNode;
	back?: { href: string; label: string };
}) {
	return (
		<header className="mb-rhythm flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
			<div className="min-w-0">
				{back && (
					<p className="text-eyebrow text-ink-soft">
						<Link href={back.href} className="hover:text-palace-700">
							{back.label}
						</Link>
					</p>
				)}
				{eyebrow && !back && (
					<p className="text-eyebrow text-ink-soft">{eyebrow}</p>
				)}
				<h1 className="font-semibold font-serif text-2xl">{title}</h1>
				{description && (
					<p className="mt-1 max-w-measure text-ink-soft text-sm">{description}</p>
				)}
			</div>
			{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
		</header>
	);
}
