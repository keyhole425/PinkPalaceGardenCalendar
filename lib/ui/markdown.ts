/**
 * The same little Markdown `components/ai/Prose.tsx` renders, taken back out
 * for the places that show one line of a note rather than the note: the year
 * grid's summary under a plant's name, a `title` on hover, a clamped preview.
 * Without it those read "## Growing coriander **here**" with the marks in.
 */
export function plainText(markdown: string): string {
	return markdown
		.split('\n')
		.map((line) => line.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*[-*]\s+/, ''))
		.join('\n')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*\s][^*]*)\*/g, '$1');
}
