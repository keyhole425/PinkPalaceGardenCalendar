/**
 * The Plants tab: what each row says, what a search finds, what an article
 * holds, and adding a plant from one.
 *
 * The lines are pure and tested as such; the rest runs against a seeded
 * database, because which side a plant comes from - the library or the
 * household - is the whole point of the page.
 */
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTempGarden, GARDEN, type TempGarden } from '@/lib/db/testing';
import { maskFromMonths } from '@/lib/schedule/months';
import {
	hereLine,
	inSeason,
	type RuleLike,
	shiftLines,
	windowText,
} from './describe';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({
	redirect: (url: string) => {
		throw new Error(`REDIRECT:${url}`);
	},
	notFound: () => {
		throw new Error('NOT_FOUND');
	},
}));

function r(
	action: string,
	months: number[],
	extra: Partial<RuleLike> = {},
): RuleLike {
	return {
		action,
		monthMask: maskFromMonths(months),
		altGroup: null,
		environmentKind: null,
		...extra,
	};
}

const OPEN = { name: 'Bed 1', kind: 'bed', windowShiftMonths: 0 };
const HOTHOUSE = { name: 'The Hothouse', kind: 'hothouse', windowShiftMonths: -1 };
const ORCHARD = { name: 'The Orchard', kind: 'orchard', windowShiftMonths: 0 };

describe('the lines', () => {
	it('leads with sowing and how long, for a crop', () => {
		expect(hereLine([r('harvest', [12, 1, 2]), r('sow', [8, 9, 10])], 70, 90)).toBe(
			'Sow Aug–Oct · ready in 70–90 days',
		);
	});

	it('gives a tree its picking and its pruning, alternatives as a choice', () => {
		const prune = [
			r('prune', [8], { altGroup: 'lemon:prune' }),
			r('prune', [9], { altGroup: 'lemon:prune' }),
		];
		expect(hereLine([r('harvest', [5, 6, 7, 8]), ...prune], null, null)).toBe(
			'Pick May–Aug · prune Aug or Sep',
		);
		expect(windowText(prune)).toBe('Aug or Sep');
	});

	it('reads a window across new year as one run', () => {
		expect(hereLine([r('harvest', [11, 12, 1, 2])], null, null)).toBe(
			'Pick Nov–Feb',
		);
	});

	it('knows a hothouse opens a month early, and an orchard is no place to sow', () => {
		const sow = [r('sow', [8, 9])];
		expect(inSeason(sow, 'sow', [OPEN], 7)).toBe(false);
		expect(inSeason(sow, 'sow', [OPEN, HOTHOUSE], 7)).toBe(true);
		expect(inSeason(sow, 'sow', [ORCHARD], 8)).toBe(false);
		// A rule for one kind of place means nothing anywhere else.
		const inside = [r('sow', [6], { environmentKind: 'hothouse' })];
		expect(inSeason(inside, 'sow', [OPEN], 6)).toBe(false);
		expect(inSeason(inside, 'sow', [HOTHOUSE], 6)).toBe(true);
	});

	it('says what a place that runs ahead does to the months', () => {
		expect(shiftLines([r('sow', [8, 9])], [OPEN, HOTHOUSE, ORCHARD])).toEqual([
			'In the hothouse, a month earlier: sow Jul–Aug.',
		]);
		expect(shiftLines([r('sow', [8, 9])], [OPEN])).toEqual([]);
	});
});

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
	const library = await import('@/lib/db/queries/library');
	const plants = await import('@/actions/plants');
	const schema = await import('@/lib/db/schema');
	const { actAs } = await import('@/lib/auth/testing');
	await seed.seedGarden(client.db);
	return { db: client.db, seed, library, plants, schema, actAs };
}

/** Runs an action and hands back where it redirected to, if it did. */
async function redirectOf(fn: () => Promise<unknown>): Promise<string | unknown> {
	try {
		return await fn();
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('REDIRECT:')) {
			return error.message.slice('REDIRECT:'.length);
		}
		throw error;
	}
}

describe('the index', () => {
	it("lists the household's plants, then the library's others, each once", async () => {
		const { library } = await modules();
		const index = await library.plantsIndex(GARDEN, '2026-10-15');
		expect(index.city).toBe('Adelaide');

		const yours = index.yours.map((p) => p.slug);
		expect(yours).toContain('lemon');
		expect(yours).toContain('tomato');
		const more = index.more.map((p) => p.slug);
		expect(more).toContain('chilli');
		expect(more).not.toContain('tomato');

		const chilli = index.more.find((p) => p.slug === 'chilli');
		expect(chilli?.kinds).toBe(3);
		expect(chilli?.sowNow).toBe(true);
		expect(chilli?.growing).toBeNull();
		const habanero = index.more.find((p) => p.slug === 'habanero');
		expect(habanero?.isVariety).toBe(true);
		expect(habanero?.kindOf).toBe('chilli');

		const lemon = index.yours.find((p) => p.slug === 'lemon');
		expect(lemon?.growing).toBe(1);
		expect(lemon?.line).toMatch(/^Pick /);
	});

	it('finds a plant by name, scientific name, other name or parent, plants first', async () => {
		const { library } = await modules();
		const index = await library.plantsIndex(GARDEN, '2026-10-15');
		const slugs = (q: string) => library.searchIndex(index, q).map((p) => p.slug);

		expect(slugs('chilli')[0]).toBe('chilli');
		expect(slugs('chilli')).toEqual(
			expect.arrayContaining(['habanero', 'birds-eye-chilli', 'carolina-reaper']),
		);
		expect(slugs('thai')).toEqual(['birds-eye-chilli']);
		expect(slugs("bird's eye")).toEqual(['birds-eye-chilli']);
		expect(slugs('capsicum chinense').sort()).toEqual([
			'carolina-reaper',
			'habanero',
		]);
		expect(slugs('citrus')).toEqual(expect.arrayContaining(['lemon', 'mandarin']));
		expect(slugs('dragon fruit')).toEqual([]);
	});
});

describe('the article', () => {
	it('fills a variety in from its parent and lists its siblings', async () => {
		const { library } = await modules();
		const article = await library.getArticle(GARDEN, 'habanero', '2026-10-15');
		if (!article) throw new Error('no habanero');

		expect(article.parent?.slug).toBe('chilli');
		expect(article.family).toBe('Solanaceae');
		expect(article.daysToMaturityMin).toBe(90);
		expect(article.inLibrary).toBe(true);
		expect(article.plantTypeId).toBeNull();
		expect(article.when.map((w) => [w.action, w.from])).toEqual([
			['sow', null],
			['transplant', 'chilli'],
			// Habanero ripens later than a chilli, so its picking is its own.
			['harvest', null],
		]);
		expect(article.shiftLines).toEqual([
			'In the hothouse, a month earlier: sow Jul–Aug.',
		]);
		expect(article.kinds?.title).toBe('Other kinds of chilli');
		expect(article.kinds?.rows.map((r) => r.slug).sort()).toEqual([
			'birds-eye-chilli',
			'carolina-reaper',
		]);
		// No orchard for a chilli.
		expect(article.places.map((p) => p.name)).not.toContain('The Orchard');
	});

	it("is the household's own for a plant only it has, and nobody else's", async () => {
		const { library, seed, db } = await modules();
		const lemon = await library.getArticle(GARDEN, 'lemon', '2026-10-15');
		expect(lemon?.inLibrary).toBe(false);
		expect(lemon?.plantTypeId).not.toBeNull();
		expect(lemon?.places.map((p) => p.name)).toContain('The Orchard');

		const friends = await seed.createSeededHousehold(db, 'Friends', 'starter');
		expect(await library.getArticle(friends, 'lemon', '2026-10-15')).toBeNull();
	});

	it('says when your months are not the library’s any more', async () => {
		const { library, db, schema } = await modules();
		const before = await library.getArticle(GARDEN, 'tomato', '2026-10-15');
		expect(before?.differs).toBe(false);

		await db
			.update(schema.careRule)
			.set({ userModifiedAt: '2026-10-15', source: 'user' })
			.where(
				and(
					eq(schema.careRule.householdId, GARDEN),
					eq(schema.careRule.action, 'sow'),
					eq(schema.careRule.plantTypeId, before?.plantTypeId ?? 0),
				),
			)
			.run();
		const after = await library.getArticle(GARDEN, 'tomato', '2026-10-15');
		expect(after?.differs).toBe(true);
	});
});

describe('adding to the garden', () => {
	it('copies the library plant and lands back on its page', async () => {
		const { plants, db, schema } = await modules();
		const form = new FormData();
		form.set('slug', 'habanero');
		expect(await redirectOf(() => plants.addToGarden(null, form))).toBe(
			'/plants/habanero?added=1',
		);

		const copy = await db
			.select()
			.from(schema.plantType)
			.where(
				and(
					eq(schema.plantType.householdId, GARDEN),
					eq(schema.plantType.slug, 'habanero'),
				),
			)
			.get();
		expect(copy?.source).toBe('library');
		expect(copy?.libraryPlantId).not.toBeNull();

		// Adding again is harmless: one copy, not two.
		await redirectOf(() => plants.addToGarden(null, form));
		const copies = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'habanero'))
			.all();
		expect(copies).toHaveLength(1);
	});

	it('refuses a plant the library does not have, and a name already taken', async () => {
		const { plants, db, schema } = await modules();
		const unknown = new FormData();
		unknown.set('slug', 'dragon-fruit');
		expect(await plants.addToGarden(null, unknown)).toEqual({
			ok: false,
			error: 'figgy doesn’t know that plant.',
		});

		await db
			.insert(schema.plantType)
			.values({ householdId: GARDEN, slug: 'chilli', commonName: 'Our chilli' })
			.run();
		const taken = new FormData();
		taken.set('slug', 'chilli');
		expect(await plants.addToGarden(null, taken)).toEqual({
			ok: false,
			error: 'You already have a plant of your own called Chilli.',
		});
	});
});
