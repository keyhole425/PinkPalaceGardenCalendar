import { describe, expect, it } from 'vitest';
import { noteSummary } from '@/lib/db/queries/grid';
import { plainText } from './markdown';

describe('plain text from Claude’s Markdown', () => {
	it('drops headings, bullets, bold and italics, and keeps the words', () => {
		expect(
			plainText(
				'## Growing coriander\n\n- Sow **direct**, it *hates* moving\n* Thin to 10 cm',
			),
		).toBe('Growing coriander\n\nSow direct, it hates moving\nThin to 10 cm');
	});

	it('leaves a sum alone', () => {
		expect(plainText('2 * 3 rows')).toBe('2 * 3 rows');
	});

	it('gives the year grid a line, not markup', () => {
		expect(
			noteSummary('## Coriander\n\n**Bolts** in the heat, so sow in autumn.'),
		).toBe('Coriander Bolts in the heat, so sow in autumn.');
	});
});
