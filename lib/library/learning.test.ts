/**
 * The library learning: anonymous evidence from grows, suggestions from what
 * gardens do, and a site admin deciding.
 *
 * The promises held here are the ones worth breaking a build over: nothing
 * stored names a garden, a garden that stops sharing leaves nothing behind,
 * nothing reaches the library without a site admin, and what a site admin
 * accepts reaches every garden except where a garden made it its own.
 */
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTempGarden, GARDEN, type TempGarden } from '@/lib/db/testing';
import { maskFromMonths, monthsFromMask } from '@/lib/schedule/months';
import { deriveGrow, redact } from './evidence';
import { flagsFor } from './flags';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({
	redirect: (url: string) => {
		throw new Error(`REDIRECT:${url}`);
	},
	notFound: () => {
		throw new Error('NOT_FOUND');
	},
}));

describe('a grow, worked out', () => {
	const planting = {
		sownOn: '2026-09-10',
		plantedOn: null,
		transplantedOn: '2026-10-20',
		status: 'active',
		notesMd: 'Nan’s tomato did well in Bed 2. Ask kim@example.com',
	};

	it('keeps months and durations, and takes the names out', () => {
		const grow = deriveGrow(
			planting,
			[
				{
					action: 'harvest',
					completedOn: '2026-12-01',
					quantityNote: '2 kg',
					notesMd: null,
				},
				{
					action: 'harvest',
					completedOn: '2027-01-15',
					quantityNote: null,
					notesMd: null,
				},
				{
					action: 'fertilise',
					completedOn: '2026-11-01',
					quantityNote: null,
					notesMd: 'Seasol',
				},
			],
			['Nan’s tomato', 'Bed 2', 'Kim'],
		);
		expect(grow).toMatchObject({
			sowMonth: 9,
			plantMonth: 10,
			seasonYear: 2026,
			daysToFirstHarvest: 82,
			harvestSpanDays: 45,
			picks: 2,
			outcome: 'harvested',
		});
		expect(grow?.notes).toEqual(['[…] did well in […]. Ask […]', '2 kg', 'Seasol']);
	});

	it('says died, pulled or growing when nothing was picked, and nothing when there is nothing', () => {
		const at = (status: string) =>
			deriveGrow({ ...planting, notesMd: null, status }, [], [])?.outcome;
		expect(at('dead')).toBe('died');
		expect(at('removed')).toBe('pulled');
		expect(at('active')).toBe('growing');
		expect(
			deriveGrow(
				{
					sownOn: null,
					plantedOn: null,
					transplantedOn: null,
					status: 'active',
					notesMd: null,
				},
				[],
				[],
			),
		).toBeNull();
	});

	it('takes out web addresses and phone numbers too', () => {
		expect(redact('see https://x.example/a or call 0412 345 678', [])).toBe(
			'see […] or call […]',
		);
	});
});

describe('the flags', () => {
	const sow = [
		{
			action: 'sow',
			monthMask: maskFromMonths([8, 9, 10]),
			altGroup: null,
			environmentKind: null,
		},
	];
	const grow = (sowMonth: number, outcome: string, days: number | null = null) => ({
		environmentKind: 'bed',
		sowMonth,
		outcome,
		daysToFirstHarvest: days,
	});

	it('notices picking from a month the library says not to sow in', () => {
		expect(
			flagsFor(sow, 70, 90, [grow(7, 'harvested'), grow(7, 'harvested')]),
		).toContain('2 sown in Jul, outside the sowing months, were picked.');
		// One is a garden, not a pattern; and the hothouse runs ahead anyway.
		expect(flagsFor(sow, 70, 90, [grow(7, 'harvested')])).toEqual([]);
		expect(
			flagsFor(sow, 70, 90, [
				{ ...grow(7, 'harvested'), environmentKind: 'hothouse' },
				{ ...grow(7, 'harvested'), environmentKind: 'hothouse' },
			]),
		).toEqual([]);
	});

	it('notices a month that keeps failing, and picking far from the library’s days', () => {
		expect(flagsFor(sow, 70, 90, [grow(10, 'died'), grow(10, 'pulled')])).toContain(
			'2 sown in Oct died or were pulled, and none were picked.',
		);
		expect(
			flagsFor(sow, 70, 90, [grow(9, 'harvested', 130), grow(9, 'harvested', 140)]),
		).toContain('First picked after 135 days, typically; the library says 70–90.');
		expect(
			flagsFor(sow, 70, 90, [grow(9, 'harvested', 80), grow(9, 'harvested', 85)]),
		).toEqual([]);
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
	const schema = await import('@/lib/db/schema');
	const evidence = await import('./evidence');
	const beds = await import('@/actions/beds');
	const rules = await import('@/actions/rules');
	const plants = await import('@/actions/plants');
	const library = await import('@/actions/library');
	const queries = await import('@/lib/db/queries/plant');
	const article = await import('@/lib/db/queries/library');
	const { actAs } = await import('@/lib/auth/testing');
	await seed.seedGarden(client.db);
	return {
		db: client.db,
		seed,
		schema,
		evidence,
		beds,
		rules,
		plants,
		library,
		queries,
		article,
		actAs,
	};
}

type M = Awaited<ReturnType<typeof modules>>;

function form(fields: Record<string, string | string[]>): FormData {
	const f = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		for (const v of Array.isArray(value) ? value : [value]) f.append(key, v);
	}
	return f;
}

async function idOf(m: M, hid: number, slug: string) {
	const row = await m.db
		.select({ id: m.schema.plantType.id })
		.from(m.schema.plantType)
		.where(
			and(
				eq(m.schema.plantType.householdId, hid),
				eq(m.schema.plantType.slug, slug),
			),
		)
		.get();
	if (!row) throw new Error(`no ${slug}`);
	return row.id;
}

async function placeId(m: M, hid: number, slug: string) {
	const row = await m.db
		.select({ id: m.schema.environment.id })
		.from(m.schema.environment)
		.where(
			and(
				eq(m.schema.environment.householdId, hid),
				eq(m.schema.environment.slug, slug),
			),
		)
		.get();
	if (!row) throw new Error(`no ${slug}`);
	return row.id;
}

/** Sows a tomato in bed 1 through the real action, as a person would. */
async function sowTomato(m: M, notes?: string) {
	await m.beds.sowInBed(
		null,
		form({
			environmentId: String(await placeId(m, GARDEN, 'bed-1')),
			plantTypeId: String(await idOf(m, GARDEN, 'tomato')),
			label: 'Nan’s tomato',
			sownOn: '2026-09-10',
		}),
	);
	const sown = await m.db
		.select()
		.from(m.schema.planting)
		.where(eq(m.schema.planting.label, 'Nan’s tomato'))
		.get();
	if (!sown) throw new Error('not sown');
	if (notes) {
		await m.db
			.update(m.schema.planting)
			.set({ notesMd: notes })
			.where(eq(m.schema.planting.id, sown.id))
			.run();
		await m.evidence.contribute(GARDEN, [sown.id]);
	}
	return sown;
}

describe('evidence', () => {
	it('is written by sowing, and says nothing about whose it is', async () => {
		const m = await modules();
		await sowTomato(m, 'Nan’s tomato loved Bed 1, the Pink Palace’s sunniest.');

		const rows = await m.db.select().from(m.schema.libraryEvidence).all();
		expect(rows).toHaveLength(1);
		const [row] = rows;
		expect(row.sowMonth).toBe(9);
		expect(row.outcome).toBe('growing');
		expect(row.environmentKind).toBe('bed');
		const stored = JSON.stringify(row);
		for (const name of ['Nan', 'Bed 1', 'Pink Palace', '2026-09-10']) {
			expect(stored).not.toContain(name);
		}
		expect(Object.keys(row)).not.toContain('householdId');
	});

	it('is deleted when a garden stops sharing, and not written while it has', async () => {
		const m = await modules();
		await sowTomato(m);
		expect(await m.db.select().from(m.schema.libraryEvidence).all()).toHaveLength(
			1,
		);

		expect(await m.library.setShareGrowing(null, form({ share: 'off' }))).toEqual({
			ok: true,
		});
		expect(await m.db.select().from(m.schema.libraryEvidence).all()).toHaveLength(
			0,
		);

		await m.beds.sowInBed(
			null,
			form({
				environmentId: String(await placeId(m, GARDEN, 'bed-2')),
				plantTypeId: String(await idOf(m, GARDEN, 'lettuce')),
				sownOn: '2026-09-12',
			}),
		);
		expect(await m.db.select().from(m.schema.libraryEvidence).all()).toHaveLength(
			0,
		);

		// Sharing again gives its grows again.
		await m.library.setShareGrowing(null, form({ share: 'on' }));
		expect(await m.db.select().from(m.schema.libraryEvidence).all()).toHaveLength(
			2,
		);
	});

	it('counts grows from before it learned, on the next deploy', async () => {
		const m = await modules();
		// Written straight to the table, as a grow from before evidence existed.
		await m.db
			.insert(m.schema.planting)
			.values({
				householdId: GARDEN,
				plantTypeId: await idOf(m, GARDEN, 'pea'),
				environmentId: await placeId(m, GARDEN, 'bed-3'),
				label: 'Pea',
				sownOn: '2026-04-02',
				status: 'dead',
			})
			.run();
		expect(await m.db.select().from(m.schema.libraryEvidence).all()).toHaveLength(
			0,
		);

		await m.seed.seedAll(m.db);
		const rows = await m.db.select().from(m.schema.libraryEvidence).all();
		expect(rows.map((r) => [r.sowMonth, r.outcome])).toEqual([[4, 'died']]);
	});

	it('can only be switched by an admin of the household', async () => {
		const m = await modules();
		m.actAs({ role: 'member' });
		expect(await m.library.setShareGrowing(null, form({ share: 'off' }))).toEqual({
			ok: false,
			error: 'Only an admin of this household can change that.',
		});
	});
});

describe('suggestions', () => {
	async function editTomatoSowing(m: M, months: string[]) {
		const tomato = await idOf(m, GARDEN, 'tomato');
		const sow = (await m.queries.getEditableRules(GARDEN, tomato)).find(
			(r) => r.action === 'sow',
		);
		if (!sow) throw new Error('no sow');
		return await m.rules.saveRule(
			null,
			form({
				plantTypeId: String(tomato),
				replacing: sow.ruleIds.join(','),
				action: 'sow',
				months,
				cadence: 'monthly',
			}),
		);
	}

	it('are filed when a garden changes a library plant’s months, one per slot', async () => {
		const m = await modules();
		expect(await editTomatoSowing(m, ['9', '10'])).toEqual({ ok: true });
		await editTomatoSowing(m, ['9', '10', '11']);

		const open = await m.db.select().from(m.schema.librarySuggestion).all();
		expect(open).toHaveLength(1);
		expect(open[0].kind).toBe('rule_change');
		expect(JSON.parse(open[0].payload).rule.months).toEqual([[9, 10, 11]]);
	});

	it('are filed for a plant the library lacks, and a rejected one stays rejected', async () => {
		const m = await modules();
		await m.plants
			.createPlantType(
				null,
				form({
					commonName: 'Kaffir lime',
					category: 'fruit_tree',
					lifecycle: 'perennial',
				}),
			)
			.catch(() => {});
		const [s] = await m.db.select().from(m.schema.librarySuggestion).all();
		expect(s.kind).toBe('new_plant');
		expect(s.subjectKey).toBeTruthy();
		expect(s.libraryPlantId).toBeNull();

		m.actAs({ siteAdmin: true });
		await m.library.rejectSuggestion(null, form({ id: String(s.id) }));
		// The same plant, unchanged, is not offered again.
		await m.evidence.afterResponse(async () => {
			const { plantOfItsOwn } = await import('./suggestions');
			await plantOfItsOwn(GARDEN, await idOf(m, GARDEN, 'kaffir-lime'));
		});
		const all = await m.db.select().from(m.schema.librarySuggestion).all();
		expect(all).toHaveLength(1);
		expect(all[0].status).toBe('rejected');
	});

	it('cannot be decided by someone who isn’t a site admin', async () => {
		const m = await modules();
		await editTomatoSowing(m, ['9']);
		const [s] = await m.db.select().from(m.schema.librarySuggestion).all();
		expect(
			await m.library.acceptSuggestion(null, form({ id: String(s.id) })),
		).toEqual({
			ok: false,
			error: 'Only a site admin can change the library.',
		});
	});
});

describe('a site admin deciding', () => {
	it('moves the library and every untouched copy, and leaves the garden that edited', async () => {
		const m = await modules();
		const friends = await m.seed.createSeededHousehold(m.db, 'Friends', 'starter');

		// The Pink Palace sows its tomatoes Sep–Nov, and says so.
		const tomato = await idOf(m, GARDEN, 'tomato');
		const sow = (await m.queries.getEditableRules(GARDEN, tomato)).find(
			(r) => r.action === 'sow',
		);
		await m.rules.saveRule(
			null,
			form({
				plantTypeId: String(tomato),
				replacing: sow?.ruleIds.join(',') ?? '',
				action: 'sow',
				months: ['9', '10', '11'],
				cadence: 'monthly',
			}),
		);
		const [s] = await m.db.select().from(m.schema.librarySuggestion).all();

		m.actAs({ siteAdmin: true });
		const result = await m.library.acceptSuggestion(
			null,
			form({ id: String(s.id) }),
		);
		expect(result).toMatchObject({ ok: true });

		const sowMonths = async (hid: number) =>
			(
				await m.db
					.select({ mask: m.schema.careRule.monthMask })
					.from(m.schema.careRule)
					.where(
						and(
							eq(m.schema.careRule.plantTypeId, await idOf(m, hid, 'tomato')),
							eq(m.schema.careRule.action, 'sow'),
							eq(m.schema.careRule.active, true),
						),
					)
					.all()
			).map((r) => monthsFromMask(r.mask));
		expect(await sowMonths(friends)).toEqual([[9, 10, 11]]);
		expect(await sowMonths(GARDEN)).toEqual([[9, 10, 11]]);

		const theirs = await m.article.getArticle(friends, 'tomato', '2026-10-15');
		expect(theirs?.libraryChange?.what).toBe('sow Sep–Nov');
		const ours = await m.article.getArticle(GARDEN, 'tomato', '2026-10-15');
		// Theirs moved; ours was already this, and is ours.
		expect(ours?.libraryChange).toBeNull();
		expect(ours?.differs).toBe(true);

		const accepted = await m.db
			.select()
			.from(m.schema.librarySuggestion)
			.where(eq(m.schema.librarySuggestion.id, s.id))
			.get();
		expect(accepted?.status).toBe('accepted');
	});

	it('takes a garden’s own plant in as a kind, and links the garden’s copy', async () => {
		const m = await modules();
		await m.plants
			.createPlantType(
				null,
				form({
					commonName: 'Jalapeño',
					scientificName: 'Capsicum annuum',
					category: 'vegetable',
					lifecycle: 'annual',
					family: 'Solanaceae',
				}),
			)
			.catch(() => {});
		const [s] = await m.db.select().from(m.schema.librarySuggestion).all();
		const chilli = await m.db
			.select()
			.from(m.schema.libraryPlant)
			.where(eq(m.schema.libraryPlant.slug, 'chilli'))
			.get();

		m.actAs({ siteAdmin: true });
		expect(
			await m.library.acceptSuggestion(
				null,
				form({ id: String(s.id), as: 'kind', target: String(chilli?.id) }),
			),
		).toMatchObject({ ok: true });

		const kind = await m.db
			.select()
			.from(m.schema.libraryPlant)
			.where(eq(m.schema.libraryPlant.commonName, 'Jalapeño'))
			.get();
		expect(kind?.parentId).toBe(chilli?.id);
		// Only what differs: the family is the chilli's, so it isn't stored twice.
		expect(kind?.family).toBeNull();
		expect(kind?.scientificName).toBe('Capsicum annuum');

		const copy = await m.db
			.select()
			.from(m.schema.plantType)
			.where(eq(m.schema.plantType.slug, 'jalapeno'))
			.get();
		expect(copy?.libraryPlantId).toBe(kind?.id);
		expect(copy?.source).toBe('user');
	});

	it('publishes the article’s words, and what gardens found', async () => {
		const m = await modules();
		const tomato = await m.db
			.select()
			.from(m.schema.libraryPlant)
			.where(eq(m.schema.libraryPlant.slug, 'tomato'))
			.get();
		m.actAs({ siteAdmin: true });
		expect(
			await m.library.saveArticle(
				null,
				form({
					id: String(tomato?.id),
					summary: 'Sow under cover; plant out after the last frost.',
					regionNote: '',
					growingMd: 'Bury the stem to the first leaves.',
					careMd: '',
					harvestMd: '',
					problemsMd: '',
					findingsMd: 'Sown in September, most were picking by Christmas.',
				}),
			),
		).toMatchObject({ ok: true });

		const article = await m.article.getArticle(GARDEN, 'tomato', '2026-10-15');
		expect(article?.findings).toBe(
			'Sown in September, most were picking by Christmas.',
		);
		expect(article?.sections.map((x) => x.title)).toEqual(['Growing it']);
		// No region note now, so the household's notes are the summary alone.
		const copy = await m.db
			.select({ notesMd: m.schema.plantType.notesMd })
			.from(m.schema.plantType)
			.where(eq(m.schema.plantType.id, await idOf(m, GARDEN, 'tomato')))
			.get();
		expect(copy?.notesMd).toBe('Sow under cover; plant out after the last frost.');
	});

	it('lets a site admin add a plant of their own from its page', async () => {
		const m = await modules();
		await m.plants
			.createPlantType(
				null,
				form({
					commonName: 'Coriander',
					scientificName: 'Coriandrum sativum',
					category: 'herb',
					lifecycle: 'annual',
					notesMd: '## Growing coriander\n\nCoriander **bolts** in the heat.',
				}),
			)
			.catch(() => {});
		const coriander = await idOf(m, GARDEN, 'coriander');
		const [offer] = await m.db.select().from(m.schema.librarySuggestion).all();
		// Its own name is not a garden's name: the notes keep it.
		expect(JSON.parse(offer.payload).notesMd).toBe(
			'## Growing coriander\n\nCoriander **bolts** in the heat.',
		);

		const promote = form({ plantTypeId: String(coriander), as: 'new' });
		expect(await m.library.promoteToLibrary(null, promote)).toEqual({
			ok: false,
			error: 'Only a site admin can change the library.',
		});

		m.actAs({ siteAdmin: true });
		await expect(m.library.promoteToLibrary(null, promote)).rejects.toThrow(
			'REDIRECT:/plants/coriander?promoted=1',
		);
		const lib = await m.db
			.select()
			.from(m.schema.libraryPlant)
			.where(eq(m.schema.libraryPlant.slug, 'coriander'))
			.get();
		expect(lib?.scientificName).toBe('Coriandrum sativum');
		const copy = await m.db
			.select()
			.from(m.schema.plantType)
			.where(eq(m.schema.plantType.id, coriander))
			.get();
		expect(copy?.libraryPlantId).toBe(lib?.id);
		expect(copy?.source).toBe('user');
		// The offer in the queue is answered by it.
		const answered = await m.db
			.select({ status: m.schema.librarySuggestion.status })
			.from(m.schema.librarySuggestion)
			.where(eq(m.schema.librarySuggestion.id, offer.id))
			.get();
		expect(answered?.status).toBe('accepted');

		// Another garden can now find it.
		const friends = await m.seed.createSeededHousehold(m.db, 'Friends', 'starter');
		const theirs = await m.article.getArticle(friends, 'coriander', '2026-10-15');
		expect(theirs?.inLibrary).toBe(true);
		expect(theirs?.plantTypeId).toBeNull();
	});

	it('takes a note from an article with names taken out', async () => {
		const m = await modules();
		expect(
			await m.library.suggestSomething(
				null,
				form({
					slug: 'tomato',
					text: 'In the Pink Palace’s Bed 1 they split after rain.',
				}),
			),
		).toEqual({ ok: true, message: 'Sent. A site admin reads every one.' });
		const [s] = await m.db.select().from(m.schema.librarySuggestion).all();
		expect(s.kind).toBe('note');
		expect(JSON.parse(s.payload).text).toBe(
			'In the […]’s […] they split after rain.',
		);
	});
});
