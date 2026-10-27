/**
 * Beds: what goes in them, when it might be ready, and whether it should go
 * there at all.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasMonth, shiftMask } from '@/lib/schedule/months';
import { createTempGarden, GARDEN, type TempGarden } from './testing';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

let garden: TempGarden;

async function freshGarden() {
	vi.resetModules();
	const client = await import('./client');
	const { seedGarden } = await import('@/db/seed/seed');
	const schema = await import('./schema');
	const beds = await import('./queries/beds');
	const actions = await import('@/actions/beds');
	await seedGarden(client.db);
	return { db: client.db, schema, beds, actions };
}

function form(fields: Record<string, string>): FormData {
	const f = new FormData();
	for (const [key, value] of Object.entries(fields)) f.append(key, value);
	return f;
}

beforeEach(async () => {
	garden?.cleanup();
	garden = await createTempGarden();
	return () => garden.cleanup();
});

describe('sowing', () => {
	it('puts a crop in a bed with a date and a spot', async () => {
		const { db, schema, beds, actions } = await freshGarden();
		const bed = await beds.getBed(GARDEN, 'bed-1');
		const tomato = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'tomato'))
			.get();

		const result = await actions.sowInBed(
			null,
			form({
				environmentId: String(bed?.id),
				plantTypeId: String(tomato?.id),
				sownOn: '2026-09-25',
				posX: '1',
				posY: '0',
			}),
		);
		expect(result.ok).toBe(true);

		const after = await beds.getBed(GARDEN, 'bed-1');
		expect(after?.occupants).toHaveLength(1);
		expect(after?.occupants[0]).toMatchObject({
			plantName: 'Tomato',
			sownOn: '2026-09-25',
			posX: 1,
			posY: 0,
		});
	});

	it('works out roughly when it will be ready', async () => {
		const { db, schema, beds, actions } = await freshGarden();
		const bed = await beds.getBed(GARDEN, 'bed-1');
		const tomato = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'tomato'))
			.get();

		await actions.sowInBed(
			null,
			form({
				environmentId: String(bed?.id),
				plantTypeId: String(tomato?.id),
				sownOn: '2026-09-25',
			}),
		);

		// Tomato is seeded at 70-90 days.
		const occupant = (await beds.getBed(GARDEN, 'bed-1'))?.occupants[0];
		expect(occupant?.readyFrom).toBe('2026-12-04');
		expect(occupant?.readyTo).toBe('2026-12-24');
	});

	it('gives no estimate for something with no sowing date', async () => {
		const { db, schema, beds } = await freshGarden();
		const bed = await beds.getBed(GARDEN, 'bed-1');
		const tomato = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'tomato'))
			.get();

		await db
			.insert(schema.planting)
			.values({
				householdId: GARDEN,
				plantTypeId: tomato?.id ?? 0,
				environmentId: bed?.id ?? 0,
				label: 'Tomato',
				status: 'active',
			})
			.run();

		expect((await beds.getBed(GARDEN, 'bed-1'))?.occupants[0].readyFrom).toBeNull();
	});
});

describe('sowing is the sowing job', () => {
	async function sow(slug: string, place: string, sownOn: string) {
		const mods = await freshGarden();
		const { getSchedule, getDashboard } = await import('./queries/garden');
		const bed = await mods.beds.getBed(GARDEN, place);
		const plant = await mods.db
			.select()
			.from(mods.schema.plantType)
			.where(eq(mods.schema.plantType.slug, slug))
			.get();
		const result = await mods.actions.sowInBed(
			null,
			form({
				environmentId: String(bed?.id),
				plantTypeId: String(plant?.id),
				sownOn,
			}),
		);
		expect(result.ok).toBe(true);

		const sown = await mods.db
			.select()
			.from(mods.schema.planting)
			.where(eq(mods.schema.planting.plantTypeId, plant?.id ?? 0))
			.get();
		const schedule = async (when: string) =>
			(await getSchedule(GARDEN, when)).plantings.find(
				(p) => p.context.plantingId === sown?.id,
			);
		const logs = await mods.db
			.select()
			.from(mods.schema.careLog)
			.where(eq(mods.schema.careLog.plantingId, sown?.id ?? 0))
			.all();
		return { schedule, logs, getDashboard };
	}

	it('ticks the window it was sown in, on the day it was sown', async () => {
		// Tomato sows August to October, a window a month.
		const { schedule, logs } = await sow('tomato', 'bed-1', '2026-09-25');

		expect(logs).toHaveLength(1);
		expect(logs[0]).toMatchObject({
			action: 'sow',
			seasonYear: 2026,
			occurrenceKey: '2026-09',
			completedOn: '2026-09-25',
		});

		const sowing = (await schedule('2026-10-27'))?.occurrences.filter(
			(o) => o.rule.action === 'sow',
		);
		expect(sowing).toHaveLength(1);
		expect(sowing?.[0]).toMatchObject({
			key: '2026-09',
			state: 'done',
			completedOn: '2026-09-25',
		});
	});

	it('never calls a window before the sowing missed', async () => {
		// Tomato sows August to October; the hothouse moves that to July to
		// September. Sown in late October, after all three - the way a habanero
		// added from the library late in the year would be.
		const { schedule, logs, getDashboard } = await sow(
			'tomato',
			'hothouse',
			'2026-10-27',
		);

		expect(logs).toHaveLength(0);
		const occurrences = (await schedule('2026-10-27'))?.occurrences ?? [];
		expect(occurrences.filter((o) => o.rule.action === 'sow')).toEqual([]);
		expect(occurrences.filter((o) => o.state === 'overdue')).toEqual([]);

		const { overdue } = await getDashboard(GARDEN, '2026-10-27');
		expect(overdue.filter((t) => t.context.plantName === 'Tomato')).toEqual([]);
	});

	it('does not ask for it to be sown again next month', async () => {
		const { schedule } = await sow('tomato', 'bed-1', '2026-09-25');
		const october = (await schedule('2026-11-05'))?.occurrences.find(
			(o) => o.rule.action === 'sow' && o.key === '2026-10',
		);
		expect(october).toBeUndefined();
	});
});

describe('rotation', () => {
	async function sowThen(sownOn: string) {
		const mods = await freshGarden();
		const bed = await mods.beds.getBed(GARDEN, 'bed-1');
		const tomato = await mods.db
			.select()
			.from(mods.schema.plantType)
			.where(eq(mods.schema.plantType.slug, 'tomato'))
			.get();
		await mods.actions.sowInBed(
			null,
			form({
				environmentId: String(bed?.id),
				plantTypeId: String(tomato?.id),
				sownOn,
			}),
		);
		return { ...mods, bedId: bed?.id ?? 0 };
	}

	it('notices the same family going back in too soon', async () => {
		const { beds, bedId } = await sowThen('2026-09-25');
		const warning = await beds.rotationWarningFor(
			GARDEN,
			bedId,
			'Solanaceae',
			'2026-10-01',
		);
		expect(warning).toMatchObject({ family: 'Solanaceae', what: 'Tomato' });
	});

	it('stops minding after two years', async () => {
		const { beds, bedId } = await sowThen('2022-09-25');
		expect(
			await beds.rotationWarningFor(GARDEN, bedId, 'Solanaceae', '2026-10-01'),
		).toBeNull();
	});

	it('does not mind a different family', async () => {
		const { beds, bedId } = await sowThen('2026-09-25');
		expect(
			await beds.rotationWarningFor(GARDEN, bedId, 'Fabaceae', '2026-10-01'),
		).toBeNull();
	});

	it('does not mind a different bed', async () => {
		const { beds } = await sowThen('2026-09-25');
		const other = await beds.getBed(GARDEN, 'bed-2');
		expect(
			await beds.rotationWarningFor(
				GARDEN,
				other?.id ?? 0,
				'Solanaceae',
				'2026-10-01',
			),
		).toBeNull();
	});

	it('never refuses - it is advice about soil', async () => {
		const { actions, db, schema, bedId } = await sowThen('2026-09-25');
		const tomato = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'tomato'))
			.get();

		const second = await actions.sowInBed(
			null,
			form({
				environmentId: String(bedId),
				plantTypeId: String(tomato?.id),
				sownOn: '2026-10-01',
			}),
		);
		expect(second.ok).toBe(true);
		if (second.ok) expect(second.warning).toContain('Tomato');
	});
});

describe('the hothouse runs ahead', () => {
	it('opens a sowing window a month before the open garden', async () => {
		const { db, schema } = await freshGarden();

		const hothouse = await db
			.select()
			.from(schema.environment)
			.where(eq(schema.environment.slug, 'hothouse'))
			.get();
		const bed = await db
			.select()
			.from(schema.environment)
			.where(eq(schema.environment.slug, 'bed-1'))
			.get();
		expect(hothouse?.windowShiftMonths).toBe(-1);
		expect(bed?.windowShiftMonths).toBe(0);

		const tomato = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'tomato'))
			.get();
		const sow = (await db.select().from(schema.careRule).all()).find(
			(r) => r.plantTypeId === tomato?.id && r.action === 'sow',
		);
		if (!sow) throw new Error('no sowing rule');

		const inside = shiftMask(sow.monthMask, hothouse?.windowShiftMonths ?? 0);
		const outside = shiftMask(sow.monthMask, bed?.windowShiftMonths ?? 0);

		// July: the hothouse is open for tomatoes and the bed is not.
		expect(hasMonth(inside, 7)).toBe(true);
		expect(hasMonth(outside, 7)).toBe(false);

		// October: the reverse, because the window moved rather than widened.
		expect(hasMonth(inside, 10)).toBe(false);
		expect(hasMonth(outside, 10)).toBe(true);
	});
});

describe('what could go in now', () => {
	it('offers the hothouse alone in the depths of winter', async () => {
		const { beds } = await freshGarden();
		const july = await beds.couldGoInThisMonth(GARDEN, 'sow', '2026-07-15');

		expect(july.length).toBeGreaterThan(0);
		// Nothing goes in the open ground in July here.
		for (const crop of july) {
			expect(crop.places.map((p) => p.name)).toEqual(['The Hothouse']);
			expect(crop.places[0].shifted).toBe(true);
		}
		expect(july.map((c) => c.commonName)).toContain('Tomato');
	});

	it('offers everywhere once the season opens, with no fanfare', async () => {
		const { beds } = await freshGarden();
		const september = await beds.couldGoInThisMonth(GARDEN, 'sow', '2026-09-25');

		const tomato = september.find((c) => c.commonName === 'Tomato');
		expect(tomato?.places.length).toBeGreaterThan(1);
		// The hothouse is not "bringing it forward" if it is open outside too.
		expect(tomato?.places.every((p) => p.shifted === false)).toBe(true);
	});

	it('says nothing when nothing is in season', async () => {
		const { beds } = await freshGarden();
		// June: everything in the starter set is shut, inside and out.
		expect(await beds.couldGoInThisMonth(GARDEN, 'sow', '2026-06-15')).toEqual([]);
	});

	it('keeps planting out apart from sowing', async () => {
		const { beds } = await freshGarden();
		// November: tomato seedlings go out, but its sowing window has shut.
		const out = await beds.couldGoInThisMonth(GARDEN, 'transplant', '2026-11-15');
		const sown = await beds.couldGoInThisMonth(GARDEN, 'sow', '2026-11-15');

		expect(out.map((c) => c.commonName)).toEqual(['Tomato']);
		expect(sown.map((c) => c.commonName)).not.toContain('Tomato');
	});
});

describe('clearing a bed', () => {
	it('frees the spot but keeps the record', async () => {
		const { beds, actions, bedId } = await (async () => {
			const mods = await freshGarden();
			const bed = await mods.beds.getBed(GARDEN, 'bed-1');
			const lettuce = await mods.db
				.select()
				.from(mods.schema.plantType)
				.where(eq(mods.schema.plantType.slug, 'lettuce'))
				.get();
			await mods.actions.sowInBed(
				null,
				form({
					environmentId: String(bed?.id),
					plantTypeId: String(lettuce?.id),
					sownOn: '2026-09-01',
				}),
			);
			return { ...mods, bedId: bed?.id ?? 0 };
		})();

		const occupant = (await beds.getBed(GARDEN, 'bed-1'))?.occupants[0];
		await actions.clearFromBed(
			null,
			form({ plantingId: String(occupant?.plantingId), slug: 'bed-1' }),
		);

		expect((await beds.getBed(GARDEN, 'bed-1'))?.occupants).toHaveLength(0);
		// Still in the history, which is what rotation reads.
		expect(await beds.getBedHistory(GARDEN, bedId)).toHaveLength(1);
		expect((await beds.getBedHistory(GARDEN, bedId))[0].status).toBe('removed');
	});
});
