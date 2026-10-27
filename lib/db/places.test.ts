/**
 * Places: adding one with a size of its own, changing it, and taking it out of
 * the garden without losing what grew there.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTempGarden, GARDEN, type TempGarden } from './testing';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({
	redirect: (url: string) => {
		throw new Error(`REDIRECT:${url}`);
	},
	notFound: () => {
		throw new Error('NOT_FOUND');
	},
}));

let garden: TempGarden;

async function freshGarden() {
	vi.resetModules();
	const client = await import('./client');
	const { seedGarden } = await import('@/db/seed/seed');
	const schema = await import('./schema');
	const beds = await import('./queries/beds');
	const places = await import('@/actions/places');
	const sowing = await import('@/actions/beds');
	await seedGarden(client.db);
	return { db: client.db, schema, beds, places, sowing };
}

function form(fields: Record<string, string>): FormData {
	const f = new FormData();
	for (const [key, value] of Object.entries(fields)) f.append(key, value);
	return f;
}

/** Runs an action that ends in a redirect, and says where it went. */
async function redirected(fn: () => Promise<unknown>): Promise<string | unknown> {
	try {
		return await fn();
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('REDIRECT:')) {
			return error.message.slice('REDIRECT:'.length);
		}
		throw error;
	}
}

beforeEach(async () => {
	garden?.cleanup();
	garden = await createTempGarden();
	return () => garden.cleanup();
});

describe('adding a place', () => {
	it('draws the plan at the size it was given', async () => {
		const { beds, places } = await freshGarden();
		const where = await redirected(() =>
			places.createPlace(
				null,
				form({
					name: 'Long bed',
					kind: 'raised_bed',
					gridCols: '6',
					gridRows: '2',
				}),
			),
		);
		expect(where).toBe('/garden/long-bed');

		const bed = await beds.getBed(GARDEN, 'long-bed');
		expect(bed).toMatchObject({ kind: 'raised_bed', gridCols: 6, gridRows: 2 });
	});

	it('will not guess a size', async () => {
		const { places } = await freshGarden();
		const result = await places.createPlace(
			null,
			form({ name: 'Mystery', kind: 'bed' }),
		);
		expect(result).toEqual({ ok: false, error: 'Say how many spots across' });
	});

	it('refuses more spots than sowing can reach', async () => {
		const { places } = await freshGarden();
		const result = await places.createPlace(
			null,
			form({ name: 'Huge', kind: 'bed', gridCols: '13', gridRows: '2' }),
		);
		expect(result.ok).toBe(false);
	});

	it('gives the orchard no grid at all', async () => {
		const { db, schema, places } = await freshGarden();
		await redirected(() =>
			places.createPlace(
				null,
				// A size left over from switching the kind is ignored, not stored.
				form({
					name: 'Top orchard',
					kind: 'orchard',
					gridCols: '3',
					gridRows: '3',
				}),
			),
		);
		const row = await db
			.select()
			.from(schema.environment)
			.where(eq(schema.environment.slug, 'top-orchard'))
			.get();
		expect(row).toMatchObject({ gridCols: null, gridRows: null });
	});
});

describe('changing a place', () => {
	async function bedWithTomatoAt(posX: number, posY: number) {
		const mods = await freshGarden();
		const bed = await mods.beds.getBed(GARDEN, 'bed-1');
		const tomato = await mods.db
			.select()
			.from(mods.schema.plantType)
			.where(eq(mods.schema.plantType.slug, 'tomato'))
			.get();
		await mods.sowing.sowInBed(
			null,
			form({
				environmentId: String(bed?.id),
				plantTypeId: String(tomato?.id),
				sownOn: '2026-09-25',
				posX: String(posX),
				posY: String(posY),
			}),
		);
		return { ...mods, bedId: bed?.id ?? 0 };
	}

	it('resizes and renames, keeping its address', async () => {
		const { beds, places, bedId } = await bedWithTomatoAt(0, 0);
		const result = await places.updatePlace(
			null,
			form({
				environmentId: String(bedId),
				name: 'Front bed',
				kind: 'bed',
				gridCols: '3',
				gridRows: '3',
			}),
		);
		expect(result).toEqual({ ok: true });

		const bed = await beds.getBed(GARDEN, 'bed-1');
		expect(bed).toMatchObject({ name: 'Front bed', gridCols: 3, gridRows: 3 });
	});

	it('will not shrink a bed out from under a plant', async () => {
		const { beds, places, bedId } = await bedWithTomatoAt(3, 0);
		const result = await places.updatePlace(
			null,
			form({
				environmentId: String(bedId),
				name: 'Bed 1',
				kind: 'bed',
				gridCols: '3',
				gridRows: '2',
			}),
		);
		expect(result).toEqual({
			ok: false,
			error: 'Tomato is in column 4. Clear it first, or keep at least 4 across.',
		});
		expect((await beds.getBed(GARDEN, 'bed-1'))?.gridCols).toBe(4);
	});
});

describe('removing a place', () => {
	it('refuses while something is growing in it', async () => {
		const { db, schema, beds, places, sowing } = await freshGarden();
		const bed = await beds.getBed(GARDEN, 'bed-2');
		const lettuce = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'lettuce'))
			.get();
		await sowing.sowInBed(
			null,
			form({ environmentId: String(bed?.id), plantTypeId: String(lettuce?.id) }),
		);

		const result = await places.removePlace(
			null,
			form({ environmentId: String(bed?.id) }),
		);
		expect(result).toEqual({
			ok: false,
			error: 'One thing is still growing here. Clear it first.',
		});
		expect(await beds.getBed(GARDEN, 'bed-2')).not.toBeNull();
	});

	it('deletes a place nothing has ever grown in', async () => {
		const { db, schema, beds, places } = await freshGarden();
		const bed = await beds.getBed(GARDEN, 'bed-3');
		const where = await redirected(() =>
			places.removePlace(null, form({ environmentId: String(bed?.id) })),
		);
		expect(where).toBe('/garden');

		const row = await db
			.select()
			.from(schema.environment)
			.where(eq(schema.environment.slug, 'bed-3'))
			.get();
		expect(row).toBeUndefined();
	});

	it('archives a place with a history, and the history keeps it', async () => {
		const { db, schema, beds, places, sowing } = await freshGarden();
		const bed = await beds.getBed(GARDEN, 'bed-2');
		const bedId = bed?.id ?? 0;
		const lettuce = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'lettuce'))
			.get();
		await sowing.sowInBed(
			null,
			form({ environmentId: String(bedId), plantTypeId: String(lettuce?.id) }),
		);
		const sown = (await beds.getBed(GARDEN, 'bed-2'))?.occupants[0];
		await sowing.clearFromBed(null, form({ plantingId: String(sown?.plantingId) }));

		await redirected(() =>
			places.removePlace(null, form({ environmentId: String(bedId) })),
		);

		// Gone from everywhere a place is chosen or shown...
		expect(await beds.getBed(GARDEN, 'bed-2')).toBeNull();
		expect((await beds.listPlaces(GARDEN)).map((p) => p.slug)).not.toContain(
			'bed-2',
		);
		const september = await beds.couldGoInThisMonth(GARDEN, 'sow', '2026-09-25');
		for (const crop of september) {
			expect(crop.places.map((p) => p.name)).not.toContain(bed?.name);
		}
		// ...and nothing new can go in it...
		const again = await sowing.sowInBed(
			null,
			form({ environmentId: String(bedId), plantTypeId: String(lettuce?.id) }),
		);
		expect(again.ok).toBe(false);
		// ...but what grew there still says where.
		expect(await beds.getBedHistory(GARDEN, bedId)).toHaveLength(1);
	});
});
