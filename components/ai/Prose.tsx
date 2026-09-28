/**
 * The little bit of Markdown Claude actually writes.
 *
 * Headings, bold, and bullets - that is the whole vocabulary in practice, and
 * a hand-rolled renderer for three things beats a dependency and a bundle for
 * two screens. Anything it does not know about is left as plain text, which
 * reads fine.
 *
 * Nothing here renders raw HTML, so there is no injection surface: the text
 * only ever becomes React elements and strings.
 */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
	// Split on **bold** and *italic*, keeping the delimiters.
	return text
		.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
		.filter((part) => part !== '')
		.map((part, index) => {
			const key = `${keyPrefix}-${index}`;
			if (part.startsWith('**') && part.endsWith('**')) {
				return <strong key={key}>{part.slice(2, -2)}</strong>;
			}
			if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
				return <em key={key}>{part.slice(1, -1)}</em>;
			}
			return <span key={key}>{part}</span>;
		});
}

export function Prose({ text }: { text: string }) {
	const lines = text.split('\n');
	const blocks: React.ReactNode[] = [];
	let bullets: string[] = [];

	const flushBullets = () => {
		if (bullets.length === 0) return;
		blocks.push(
			<ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
				{bullets.map((item, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: parsed markdown - position is the only identity a bullet has, and the block is rebuilt whole
					<li key={`${item.slice(0, 20)}-${index}`}>
						{inline(item, `li-${blocks.length}-${index}`)}
					</li>
				))}
			</ul>,
		);
		bullets = [];
	};

	for (const [index, raw] of lines.entries()) {
		const line = raw.trimEnd();

		if (/^\s*[-*]\s+/.test(line)) {
			bullets.push(line.replace(/^\s*[-*]\s+/, ''));
			continue;
		}
		flushBullets();

		if (line.trim() === '') continue;

		const heading = line.match(/^(#{1,4})\s+(.*)$/);
		if (heading) {
			blocks.push(
				<h3 key={`h-${index}`} className="mt-3 font-semibold first:mt-0">
					{inline(heading[2], `h-${index}`)}
				</h3>,
			);
			continue;
		}

		blocks.push(<p key={`p-${index}`}>{inline(line, `p-${index}`)}</p>);
	}
	flushBullets();

	return <div className="space-y-2">{blocks}</div>;
}
