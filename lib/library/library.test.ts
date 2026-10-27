/**
 * The library: one catalogue every garden copies from, and copies that
 * follow it only as far as nobody has made them their own.
 *
 * Tested against a real database, like seeding, because the promise is the
 * same one and just as easy to break: following the library must never undo
 * something a person did, or un-tick a job they recorded.
 */
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asHouseholdId } from '@/lib/db/tenancy';
import { createTempGarden, GARDEN, type TempGarden } from '@/lib/db/testing';
import { maskFromMonths, monthsFromMask } from '@/lib/schedule/months';
import { type LibraryPlantRow, type LibraryRuleRow, resolvePlant } from './resolve';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

let garden: TempGarden;

beforeEach(async () => {
	garden?.cleanup();
	garden = await createTempGarden();
	return () => garden.cleanup();
});

async function modules() {
	vi.resetModules();
	const client = await import('@/lib/db/client');
	const seed = await import('@/db/seed/seed');
	const library = await import('@/db/seed/library');
	const resolve = await import('./resolve');
	const sync = await import('./sync');
	const schema = await import('@/lib/db/schema');
	return { db: client.db, seed, library, resolve, sync, schema };
}

function row(over: Partial<LibraryPlantRow>): LibraryPlantRow {
	return {
		id: 1,
		slug: 'x',
		parentId: null,
		commonName: 'X',
		scientificName: null,
		aliases: null,
		category: null,
		lifecycle: null,
		family: null,
		daysToMaturityMin: null,
		daysToMaturityMax: null,
		spacingCm: null,
		rowSpacingCm: null,
		summary: null,
		growingMd: null,
		careMd: null,
		harvestMd: null,
		problemsMd: null,
		citations: null,
		findingsMd: null,
		needsReview: false,
		revision: 1,
		source: 'seed',
		sourceRef: null,
		createdAt: '2026-10-27',
		curatedAt: null,
		...over,
	};
}

/** Drizzle wraps the driver's error; the trigger's own words are its cause. */
async function refusal(promise: Promise<unknown>): Promise<string> {
	try {
		await promise;
	} catch (error) {
		const cause = error instanceof Error ? error.cause : undefined;
		return String(cause instanceof Error ? cause.message : error);
	}
	return 'not refused';
}

function rule(
	id: number,
	libraryPlantId: number,
	action: LibraryRuleRow['action'],
	months: number[],
): LibraryRuleRow {
	return {
		id,
		libraryPlantId,
		region: 'adelaide',
		action,
		monthMask: maskFromMonths(months),
		cadence: 'monthly',
		altGroup: null,
		environmentKind: null,
		label: null,
		note: null,
		source: 'seed',
		sourceRef: null,
		createdAt: '2026-10-27',
		curatedAt: null,
	};
}

describe('resolving a variety', () => {
	const chilli = row({
		id: 1,
		slug: 'chilli',
		commonName: 'Chilli',
		scientificName: 'Capsicum',
		category: 'vegetable',
		lifecycle: 'annual',
		family: 'Solanaceae',
		daysToMaturityMin: 70,
		daysToMaturityMax: 100,
		spacingCm: 45,
		summary: 'Wants a long, hot season.',
		revision: 3,
	});
	const habanero = row({
		id: 2,
		slug: 'habanero',
		parentId: 1,
		commonName: 'Habanero',
		scientificName: 'Capsicum chinense',
		daysToMaturityMin: 90,
		daysToMaturityMax: 120,
		needsReview: true,
		revision: 2,
	});
	const rules = [
		rule(1, 1, 'sow', [8, 9, 10]),
		rule(2, 1, 'transplant', [10, 11]),
		rule(3, 1, 'harvest', [1, 2, 3, 4, 5]),
		rule(4, 2, 'sow', [8, 9]),
		// Another region's window never leaks in.
		{ ...rule(5, 2, 'harvest', [7]), region: 'elsewhere' as 'adelaide' },
	];
	const notes = [
		{ libraryPlantId: 1, region: 'adelaide' as const, noteMd: 'Happy here.' },
	];

	it('fills in what the variety leaves out, and keeps what it says', () => {
		const r = resolvePlant(habanero, chilli, 'adelaide', rules, notes);
		expect(r.commonName).toBe('Habanero');
		expect(r.scientificName).toBe('Capsicum chinense');
		expect(r.daysToMaturityMin).toBe(90);
		expect(r.family).toBe('Solanaceae');
		expect(r.category).toBe('vegetable');
		expect(r.spacingCm).toBe(45);
		expect(r.summary).toBe('Wants a long, hot season.');
		expect(r.regionNote).toBe('Happy here.');
		expect(r.parent?.slug).toBe('chilli');
	});

	it("replaces the parent's rules for an action it names, and inherits the rest", () => {
		const r = resolvePlant(habanero, chilli, 'adelaide', rules, notes);
		const by = Object.fromEntries(
			r.rules.map((x) => [
				x.action,
				{ months: monthsFromMask(x.monthMask), from: x.from },
			]),
		);
		expect(by.sow).toEqual({ months: [8, 9], from: 'Habanero' });
		expect(by.transplant).toEqual({ months: [10, 11], from: 'Chilli' });
		expect(by.harvest).toEqual({ months: [1, 2, 3, 4, 5], from: 'Chilli' });
		expect(r.rules.filter((x) => x.action === 'sow')).toHaveLength(1);
	});

	it('adds the revisions, and catches needing review', () => {
		const r = resolvePlant(habanero, chilli, 'adelaide', rules, notes);
		expect(r.revision).toBe(5);
		expect(r.needsReview).toBe(true);
		expect(resolvePlant(chilli, null, 'adelaide', rules, notes).needsReview).toBe(
			false,
		);
	});

	it('refuses to resolve a variety without its parent', () => {
		expect(() => resolvePlant(habanero, null, 'adelaide', rules, notes)).toThrow(
			/needs its parent/,
		);
	});
});

describe('the library tables', () => {
	it('keeps varieties one level deep', async () => {
		const { db, library, schema } = await modules();
		await library.seedLibrary(db);
		const habanero = await db
			.select()
			.from(schema.libraryPlant)
			.where(eq(schema.libraryPlant.slug, 'habanero'))
			.get();
		const chilli = await db
			.select()
			.from(schema.libraryPlant)
			.where(eq(schema.libraryPlant.slug, 'chilli'))
			.get();
		if (!habanero || !chilli) throw new Error('no chilli');

		// A kind of habanero is one level too many.
		expect(
			await refusal(
				db
					.insert(schema.libraryPlant)
					.values({
						slug: 'red-habanero',
						parentId: habanero.id,
						commonName: 'Red',
					})
					.run(),
			),
		).toMatch(/cannot have varieties/);

		// Nor can a plant with kinds of its own become a kind of something.
		expect(
			await refusal(
				db
					.update(schema.libraryPlant)
					.set({ parentId: habanero.id })
					.where(eq(schema.libraryPlant.id, chilli.id))
					.run(),
			),
		).toMatch(/cannot have varieties/);
	});

	it('refuses a plant that does not say what it is', async () => {
		const { db, schema } = await modules();
		expect(
			await refusal(
				db
					.insert(schema.libraryPlant)
					.values({ slug: 'mystery', commonName: 'Mystery' })
					.run(),
			),
		).toMatch(/CHECK constraint failed/);
	});
});

describe('seeding the library', () => {
	it('writes chilli and its kinds, and revises nothing on a second run', async () => {
		const { db, library, resolve } = await modules();
		const first = await library.seedLibrary(db);
		expect(first.plants).toBeGreaterThan(10);

		const [chilli, birdsEye] = await resolve.loadResolved(
			db,
			['chilli', 'birds-eye-chilli'],
			'adelaide',
		);
		expect(chilli.parent).toBeNull();
		expect(birdsEye.parent?.slug).toBe('chilli');
		expect(birdsEye.aliases).toContain('Thai chilli');
		// Bird's eye names no months of its own: they are all the chilli's.
		expect(birdsEye.rules.map((r) => r.from)).toEqual(
			chilli.rules.map(() => 'Chilli'),
		);

		const second = await library.seedLibrary(db);
		expect(second.plants).toBe(0);
		expect(second.revised).toBe(0);
	});

	it('puts back what drifted, bumping the revision, but leaves curated plants', async () => {
		const { db, library, schema } = await modules();
		await library.seedLibrary(db);
		const tomato = eq(schema.libraryPlant.slug, 'tomato');
		const basil = eq(schema.libraryPlant.slug, 'basil');
		await db
			.update(schema.libraryPlant)
			.set({ summary: 'old words' })
			.where(tomato)
			.run();
		await db
			.update(schema.libraryPlant)
			.set({ summary: 'a site admin wrote this', curatedAt: '2026-10-27' })
			.where(basil)
			.run();

		const report = await library.seedLibrary(db);
		expect(report.revised).toBe(1);
		expect(report.leftAlone).toContain('basil');

		const t = await db.select().from(schema.libraryPlant).where(tomato).get();
		expect(t?.summary).not.toBe('old words');
		expect(t?.revision).toBe(2);
		const b = await db.select().from(schema.libraryPlant).where(basil).get();
		expect(b?.summary).toBe('a site admin wrote this');
	});
});

describe('a garden seeded before there was a library', () => {
	/**
	 * Turns a freshly seeded garden back into what the old seed left: the
	 * same vegetables, written from the code, not linked to anything.
	 */
	async function unlink(m: Awaited<ReturnType<typeof modules>>) {
		const { db, schema } = m;
		const veg = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.source, 'library'))
			.all();
		for (const p of veg) {
			await db
				.update(schema.plantType)
				.set({ source: 'seed', sourceRef: 'Starter set', libraryPlantId: null })
				.where(eq(schema.plantType.id, p.id))
				.run();
		}
		const rules = await db
			.select()
			.from(schema.careRule)
			.where(eq(schema.careRule.source, 'library'))
			.all();
		for (const r of rules) {
			await db
				.update(schema.careRule)
				.set({
					source: 'seed',
					sourceRef: `ORCHARD SCHEDULE.numbers / x / ${r.action}`,
				})
				.where(eq(schema.careRule.id, r.id))
				.run();
		}
		return veg;
	}

	it('links its vegetables in place, keeping every rule and every tick', async () => {
		const m = await modules();
		const { db, seed, schema } = m;
		await seed.seedGarden(db);
		const veg = await unlink(m);
		expect(veg.length).toBeGreaterThan(5);

		const tomato = veg.find((p) => p.slug === 'tomato');
		if (!tomato) throw new Error('no tomato');
		const [bed] = await db
			.select()
			.from(schema.environment)
			.where(eq(schema.environment.slug, 'bed-1'))
			.all();
		const planting = await db
			.insert(schema.planting)
			.values({
				householdId: GARDEN,
				plantTypeId: tomato.id,
				environmentId: bed.id,
				label: 'Tomato',
			})
			.returning()
			.get();
		const sow = await db
			.select()
			.from(schema.careRule)
			.where(
				and(
					eq(schema.careRule.plantTypeId, tomato.id),
					eq(schema.careRule.action, 'sow'),
				),
			)
			.get();
		if (!sow) throw new Error('no sow rule');
		await db
			.insert(schema.careLog)
			.values({
				householdId: GARDEN,
				plantingId: planting.id,
				careRuleId: sow.id,
				action: 'sow',
				seasonYear: 2026,
				occurrenceKey: '2026-09',
				completedOn: '2026-09-12',
			})
			.run();
		const ruleIds = (
			await db.select({ id: schema.careRule.id }).from(schema.careRule).all()
		)
			.map((r) => r.id)
			.sort();

		const report = await seed.seedGarden(db);
		expect(report.plantTypes).toBe(0);
		expect(report.rules).toBe(0);

		const after = (
			await db.select({ id: schema.careRule.id }).from(schema.careRule).all()
		)
			.map((r) => r.id)
			.sort();
		expect(after).toEqual(ruleIds);
		const log = await db.select().from(schema.careLog).get();
		expect(log?.careRuleId).toBe(sow.id);

		const linked = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.id, tomato.id))
			.get();
		expect(linked?.source).toBe('library');
		expect(linked?.libraryPlantId).not.toBeNull();
		// The orchard is still the spreadsheet's.
		const lemon = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'lemon'))
			.get();
		expect(lemon?.source).toBe('seed');
		expect(lemon?.libraryPlantId).toBeNull();
	});
});

describe('following the library', () => {
	it('moves an untouched copy with the library, and leaves an edited one', async () => {
		const { db, seed, resolve, sync, schema } = await modules();
		await seed.seedGarden(db);
		const friends = await seed.createSeededHousehold(db, 'Friends', 'starter');

		// The Pink Palace decides it sows its tomatoes in September only.
		const ours = await db
			.select()
			.from(schema.plantType)
			.where(
				and(
					eq(schema.plantType.householdId, GARDEN),
					eq(schema.plantType.slug, 'tomato'),
				),
			)
			.get();
		if (!ours) throw new Error('no tomato');
		await db
			.update(schema.careRule)
			.set({ monthMask: maskFromMonths([9]), userModifiedAt: '2026-10-27' })
			.where(
				and(
					eq(schema.careRule.plantTypeId, ours.id),
					eq(schema.careRule.action, 'sow'),
				),
			)
			.run();

		// A site admin moves the library's tomato sowing a month later.
		const lib = await db
			.select()
			.from(schema.libraryPlant)
			.where(eq(schema.libraryPlant.slug, 'tomato'))
			.get();
		if (!lib) throw new Error('no library tomato');
		await db
			.update(schema.libraryRule)
			.set({ monthMask: maskFromMonths([9, 10, 11]), curatedAt: '2026-10-27' })
			.where(
				and(
					eq(schema.libraryRule.libraryPlantId, lib.id),
					eq(schema.libraryRule.action, 'sow'),
				),
			)
			.run();
		await db
			.update(schema.libraryPlant)
			.set({ revision: lib.revision + 1 })
			.where(eq(schema.libraryPlant.id, lib.id))
			.run();

		const [tomato] = await resolve.loadResolved(db, ['tomato'], 'adelaide');
		const sowMonths = async (hid: number) => {
			const rows = await db
				.select({ mask: schema.careRule.monthMask })
				.from(schema.careRule)
				.innerJoin(
					schema.plantType,
					eq(schema.careRule.plantTypeId, schema.plantType.id),
				)
				.where(
					and(
						eq(schema.careRule.householdId, hid),
						eq(schema.plantType.slug, 'tomato'),
						eq(schema.careRule.action, 'sow'),
						eq(schema.careRule.active, true),
					),
				)
				.all();
			return rows.map((r) => monthsFromMask(r.mask));
		};

		const theirs = await sync.followLibrary(db, friends, tomato);
		expect(theirs.rules).toBe(1);
		expect(await sowMonths(friends)).toEqual([[9, 10, 11]]);

		const mine = await sync.followLibrary(db, GARDEN, tomato);
		expect(mine.leftAlone).toContain('tomato:sow');
		expect(await sowMonths(GARDEN)).toEqual([[9]]);

		// The re-seed agrees, and does not put the old window back for either.
		await seed.seedAll(db);
		expect(await sowMonths(friends)).toEqual([[9, 10, 11]]);
		expect(await sowMonths(GARDEN)).toEqual([[9]]);
	});

	it('copies a variety whole: its own figures, and its parent’s family and months', async () => {
		const { db, seed, resolve, sync, schema } = await modules();
		const friends = await seed.createSeededHousehold(db, 'Friends', 'starter');
		const [habanero] = await resolve.loadResolved(db, ['habanero'], 'adelaide');

		const report = await sync.followLibrary(db, friends, habanero);
		expect(report.created).toBe(true);

		const copy = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.id, report.plantTypeId ?? 0))
			.get();
		expect(copy?.commonName).toBe('Habanero');
		expect(copy?.daysToMaturityMin).toBe(90);
		expect(copy?.family).toBe('Solanaceae');
		expect(copy?.source).toBe('library');

		const rules = await db
			.select()
			.from(schema.careRule)
			.where(eq(schema.careRule.plantTypeId, report.plantTypeId ?? 0))
			.all();
		expect(rules.every((r) => r.source === 'library')).toBe(true);
		const transplant = rules.find((r) => r.action === 'transplant');
		expect(transplant?.sourceRef).toBe('Library / Chilli / transplant');
		const sow = rules.find((r) => r.action === 'sow');
		expect(sow && monthsFromMask(sow.monthMask)).toEqual([8, 9]);

		// Following again changes nothing.
		const again = await sync.followLibrary(db, friends, habanero);
		expect(again.created).toBe(false);
		expect(again.rules).toBe(0);
	});

	it("leaves a household's own plant that happens to share the name", async () => {
		const { db, seed, resolve, sync, schema } = await modules();
		const friends = await seed.createSeededHousehold(db, 'Friends', 'starter');
		await db
			.insert(schema.plantType)
			.values({
				householdId: friends,
				slug: 'chilli',
				commonName: 'Our chilli',
				source: 'user',
			})
			.run();
		const [chilli] = await resolve.loadResolved(db, ['chilli'], 'adelaide');

		const report = await sync.followLibrary(db, friends, chilli);
		expect(report.plantTypeId).toBeNull();
		expect(report.leftAlone).toEqual(['chilli']);
		const ours = await db
			.select()
			.from(schema.plantType)
			.where(
				and(
					eq(schema.plantType.householdId, friends),
					eq(schema.plantType.slug, 'chilli'),
				),
			)
			.all();
		expect(ours).toHaveLength(1);
		expect(ours[0].commonName).toBe('Our chilli');
	});

	it('gives a garden made before any seed has run a library to start from', async () => {
		const { db, seed, schema } = await modules();
		const hid = await seed.createSeededHousehold(db, 'First', 'starter');
		expect(hid).toBe(asHouseholdId(1));
		const plants = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.householdId, hid))
			.all();
		expect(plants.map((p) => p.slug).sort()).toEqual([
			'basil',
			'carrot',
			'dwarf-bean',
			'garlic',
			'lettuce',
			'pea',
			'pumpkin',
			'silverbeet',
			'tomato',
			'zucchini',
		]);
		expect(plants.every((p) => p.libraryPlantId !== null)).toBe(true);
	});
});
