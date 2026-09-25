export function Section({
	title,
	count,
	tone = 'plain',
	empty,
	children,
}: {
	title: string;
	count: number;
	tone?: 'plain' | 'alert';
	empty: string;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-2">
			<h2 className="flex items-baseline gap-2 font-semibold text-lg">
				<span className={tone === 'alert' ? 'text-prune' : undefined}>{title}</span>
				<span className="font-normal text-ink-soft text-sm">{count}</span>
			</h2>
			{count === 0 ? (
				<p className="rounded-md border border-rule border-dashed p-3 text-ink-soft text-sm">
					{empty}
				</p>
			) : (
				<ul className="space-y-2">{children}</ul>
			)}
		</section>
	);
}
