import { describe, expect, it } from 'vitest';
import { noteSummary } from './queries/grid';

describe('noteSummary', () => {
	it('leaves a short note alone', async () => {
		expect(noteSummary('Prune in winter.')).toBe('Prune in winter.');
	});

	it('is null for nothing', async () => {
		expect(noteSummary(null)).toBeNull();
		expect(noteSummary('   ')).toBeNull();
	});

	it('keeps the first sentence and marks the cut', async () => {
		const notes =
			'Harvest late summer through autumn, once the fruit gives to a thumb. ' +
			'Prune in winter while dormant. Fertilise in early spring.';
		const got = noteSummary(notes);
		expect(got).toBe(
			'Harvest late summer through autumn, once the fruit gives to a thumb.…',
		);
	});

	it('flattens the newlines that made the grid row tall', async () => {
		expect(noteSummary('Prune hard.\n\nThen feed.')).toBe('Prune hard. Then feed.');
	});

	// The case that started this: Plum's seeded note is 2,526 characters.
	it('caps a note with no early full stop', async () => {
		const long = `${'a'.repeat(60)} ${'b'.repeat(200)}`;
		const got = noteSummary(long);
		expect(got).not.toBeNull();
		expect((got as string).length).toBeLessThanOrEqual(121);
	});
});
