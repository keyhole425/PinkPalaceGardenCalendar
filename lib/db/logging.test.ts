/**
 * Where a written-down entry lands.
 *
 * The model's reading of the sentence is not exercised here - this is what
 * happens to the entries once they exist, which is where "recorded 2 things"
 * can still quietly mean "and left both jobs overdue".
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTempGarden, type TempGarden } from './testing';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

let garden: TempGarden;

async function freshGarden() {
	vi.resetModules();
	const client = await import('./client');
	const { seedGarden } = await import('@/db/seed/seed');
	const schema = await import('./schema');
	const log = await import('@/actions/log');
	const garden_ = await import('./queries/garden');
	seedGarden(client.db);
	return { db: client.db, schema, log, garden: garden_ };
}

function entries(list: Record<string, unknown>[]): FormData {
	const f = new FormData();
	f.append('entries', JSON.stringify(list));
	return f;
}

function plantingNamed(
	db: Awaited<ReturnType<typeof freshGarden>>['db'],
	schema: Awaited<ReturnType<typeof freshGarden>>['schema'],
	label: string,
) {
	return db
		.select()
		.from(schema.planting)
		.where(eq(schema.planting.label, label))
		.get();
}

beforeEach(() => {
	garden?.cleanup();
	garden = createTempGarden();
	return () => garden.cleanup();
});

describe('recording what you wrote down', () => {
	it('ticks off a job done inside its window', async () => {
		const { db, schema, log, garden: g } = await freshGarden();
		const mulberry = plantingNamed(db, schema, 'Mulberry');

		const result = await log.commitLog(
			null,
			entries([
				{ plantingId: mulberry?.id, action: 'prune', completedOn: '2026-08-14' },
			]),
		);
		expect(result).toEqual({ ok: true, written: 1 });

		// Not merely recorded - the August pruning is answered.
		const board = g.getDashboard('2026-09-25');
		expect(board.overdue.some((t) => t.context.label === 'Mulberry')).toBe(false);
	});

	it('ticks off a job done late, which is the usual reason to write it down', async () => {
		const { db, schema, log, garden: g } = await freshGarden();
		const mulberry = plantingNamed(db, schema, 'Mulberry');

		// Pruned in September; the window was August and had closed.
		await log.commitLog(
			null,
			entries([
				{ plantingId: mulberry?.id, action: 'prune', completedOn: '2026-09-22' },
			]),
		);

		const board = g.getDashboard('2026-09-25');
		expect(board.overdue.some((t) => t.context.label === 'Mulberry')).toBe(false);
		expect(board.recentlyDone.some((t) => t.context.label === 'Mulberry')).toBe(
			true,
		);
	});

	it('does not answer a job missed so long ago it is history', async () => {
		const { db, schema, log } = await freshGarden();
		const cherry = plantingNamed(db, schema, 'Cherry #1');

		// Cherry pruning closes in February; this is nine months later.
		await log.commitLog(
			null,
			entries([
				{ plantingId: cherry?.id, action: 'prune', completedOn: '2026-11-20' },
			]),
		);

		const row = db.select().from(schema.careLog).all().at(-1);
		// Recorded, but as its own thing rather than pretending to answer
		// something from the far side of the year.
		expect(row?.action).toBe('prune');
		expect(row?.occurrenceKey).toBeNull();
	});

	it('leaves a picking as a picking', async () => {
		const { db, schema, log } = await freshGarden();
		const lemon = plantingNamed(db, schema, 'Lemon');

		await log.commitLog(
			null,
			entries([
				{
					plantingId: lemon?.id,
					action: 'harvest',
					completedOn: '2026-07-10',
					quantity: '2 kg',
				},
			]),
		);

		const row = db.select().from(schema.careLog).all().at(-1);
		expect(row?.quantityNote).toBe('2 kg');
		// Harvest is a season, so nothing is ticked off and you can pick again.
		expect(row?.occurrenceKey).toBeNull();
	});

	it('lets you pick twice in one day, because you might', async () => {
		const { db, schema, log } = await freshGarden();
		const lemon = plantingNamed(db, schema, 'Lemon');
		const pick = (quantity: string) => ({
			plantingId: lemon?.id,
			action: 'harvest',
			completedOn: '2026-07-10',
			quantity,
		});

		await log.commitLog(null, entries([pick('2 kg')]));
		const second = await log.commitLog(null, entries([pick('1 kg')]));

		expect(second).toEqual({ ok: true, written: 1 });
		expect(db.select().from(schema.careLog).all()).toHaveLength(2);
	});

	it('does not record the same job twice', async () => {
		const { db, schema, log } = await freshGarden();
		const mulberry = plantingNamed(db, schema, 'Mulberry');
		const one = {
			plantingId: mulberry?.id,
			action: 'prune',
			completedOn: '2026-08-14',
		};

		await log.commitLog(null, entries([one]));
		const second = await log.commitLog(null, entries([one]));

		// The duplicate is skipped rather than blowing up the whole sentence.
		expect(second).toEqual({ ok: true, written: 0 });
		expect(db.select().from(schema.careLog).all()).toHaveLength(1);
	});

	it('records the rest of a sentence when one entry is a duplicate', async () => {
		const { db, schema, log } = await freshGarden();
		const mulberry = plantingNamed(db, schema, 'Mulberry');
		const lemon = plantingNamed(db, schema, 'Lemon');

		await log.commitLog(
			null,
			entries([
				{ plantingId: mulberry?.id, action: 'prune', completedOn: '2026-08-14' },
			]),
		);
		const result = await log.commitLog(
			null,
			entries([
				{ plantingId: mulberry?.id, action: 'prune', completedOn: '2026-08-14' },
				{ plantingId: lemon?.id, action: 'harvest', completedOn: '2026-07-10' },
			]),
		);

		expect(result).toEqual({ ok: true, written: 1 });
		expect(db.select().from(schema.careLog).all()).toHaveLength(2);
	});

	it('ignores an entry for a plant that has gone', async () => {
		const { log } = await freshGarden();
		const result = await log.commitLog(
			null,
			entries([{ plantingId: 99_999, action: 'prune', completedOn: '2026-08-14' }]),
		);
		expect(result).toEqual({ ok: true, written: 0 });
	});
});
