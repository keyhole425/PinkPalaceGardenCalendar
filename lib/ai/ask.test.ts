/**
 * The chat's tools.
 *
 * The model's part is not exercised here; these cover what it can reach, which
 * is the part that matters for safety. Every one of them reads.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTempGarden, type TempGarden } from '@/lib/db/testing';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

let garden: TempGarden;

async function freshGarden() {
	vi.resetModules();
	const client = await import('@/lib/db/client');
	const { seedGarden } = await import('@/db/seed/seed');
	const tools = await import('./ask/tools');
	const beds = await import('@/actions/beds');
	const schema = await import('@/lib/db/schema');
	seedGarden(client.db);
	return { db: client.db, tools, beds, schema };
}

beforeEach(() => {
	garden?.cleanup();
	garden = createTempGarden();
	return () => garden.cleanup();
});

describe('what the chat can see', () => {
	it('lists the plants with their slugs', async () => {
		const { tools } = await freshGarden();
		const plants = tools.listPlants();
		expect(plants.map((p) => p.slug)).toContain('lemon');
		expect(plants.find((p) => p.slug === 'lemon')?.name).toBe('Lemon');
	});

	it('reports what is due on a given day', async () => {
		const { tools } = await freshGarden();
		const august = tools.whatsDue('2026-08-20');
		expect(august.due.some((d) => d.action === 'prune')).toBe(true);
		const june = tools.whatsDue('2026-06-15');
		expect(june.harvesting.length).toBeGreaterThan(0);
	});

	it('gives one plant its windows and its notes', async () => {
		const { tools } = await freshGarden();
		const fig = tools.plantSchedule('fig');
		if ('error' in fig) throw new Error(fig.error);
		expect(fig.rules.length).toBeGreaterThan(0);
		expect(fig.notes).toContain('dormancy');
	});

	it('says plainly when it does not know a plant', async () => {
		const { tools } = await freshGarden();
		expect(tools.plantSchedule('dragonfruit')).toHaveProperty('error');
		expect(tools.plantHistory('dragonfruit')).toHaveProperty('error');
	});

	it('reads back what was recorded', async () => {
		const { db, schema, tools } = await freshGarden();
		const lemon = db
			.select()
			.from(schema.planting)
			.all()
			.find((p) => p.label === 'Lemon');

		db.insert(schema.careLog)
			.values({
				plantingId: lemon?.id ?? 0,
				action: 'harvest',
				seasonYear: 2026,
				completedOn: '2026-07-10',
				quantityNote: '2.5 kg',
			})
			.run();

		const history = tools.plantHistory('lemon');
		if ('error' in history) throw new Error(history.error);
		expect(history.entries[0]).toMatchObject({
			action: 'harvest',
			quantity: '2.5 kg',
		});
	});

	it('knows what could go in this month, and where', async () => {
		const { tools } = await freshGarden();
		const july = tools.whatToSow('2026-07-15');
		expect(july.crops.length).toBeGreaterThan(0);
		expect(july.crops.every((c) => c.places.includes('The Hothouse'))).toBe(true);
	});

	it('describes the beds and what is ready when', async () => {
		const { tools, beds, db, schema } = await freshGarden();
		const bed = db
			.select()
			.from(schema.environment)
			.all()
			.find((e) => e.slug === 'bed-1');
		const tomato = db
			.select()
			.from(schema.plantType)
			.all()
			.find((p) => p.slug === 'tomato');

		const form = new FormData();
		form.append('environmentId', String(bed?.id));
		form.append('plantTypeId', String(tomato?.id));
		form.append('sownOn', '2026-09-25');
		await beds.sowInBed(null, form);

		const plan = tools.beds();
		const bedOne = plan.find((b) => b.name === 'Bed 1');
		expect(bedOne?.growing[0]).toMatchObject({ what: 'Tomato' });
		expect(bedOne?.growing[0].readyFrom).toBe('2026-12-04');
	});

	it('reports the hothouse as running ahead', async () => {
		const { tools } = await freshGarden();
		const hothouse = tools.beds().find((b) => b.name === 'The Hothouse');
		expect(hothouse?.runsAheadByMonths).toBe(1);
		expect(hothouse?.frostFree).toBe(true);
	});
});
