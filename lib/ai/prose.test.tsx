/**
 * The renderer only has to handle what Claude actually writes.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Prose } from '@/components/ai/Prose';

const html = (text: string) => renderToStaticMarkup(<Prose text={text} />);

describe('rendering what Claude wrote', () => {
	it('turns a heading into a heading', () => {
		expect(html('## Plum in Adelaide')).toContain('<h3');
		expect(html('## Plum in Adelaide')).toContain('Plum in Adelaide');
		expect(html('## Plum in Adelaide')).not.toContain('##');
	});

	it('turns bold into bold', () => {
		const out = html('**Feeding.** Once the tree is cropping.');
		expect(out).toContain('<strong>Feeding.</strong>');
		expect(out).not.toContain('**');
	});

	it('handles the botanical italics it likes to use', () => {
		expect(html('Japanese plums (*Prunus salicina*) are common.')).toContain(
			'<em>Prunus salicina</em>',
		);
	});

	it('gathers consecutive bullets into one list', () => {
		const out = html('Worth knowing:\n- silver leaf\n- fruit fly\n- birds');
		expect(out.match(/<ul/g)).toHaveLength(1);
		expect(out.match(/<li/g)).toHaveLength(3);
	});

	it('keeps separate lists separate', () => {
		const out = html('- one\n\ntext between\n\n- two');
		expect(out.match(/<ul/g)).toHaveLength(2);
	});

	it('leaves ordinary prose alone', () => {
		expect(html('Plums are fully deciduous.')).toContain(
			'Plums are fully deciduous.',
		);
	});

	it('never emits raw HTML from the text', () => {
		const out = html('<script>alert(1)</script> and **bold**');
		expect(out).not.toContain('<script>');
		expect(out).toContain('&lt;script&gt;');
	});

	it('copes with nothing at all', () => {
		expect(() => html('')).not.toThrow();
	});
});
