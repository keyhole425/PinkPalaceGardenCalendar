/**
 * One garden cannot see or touch another.
 *
 * Two locks, both tested here: every query and action is scoped by the
 * household of whoever is asking, and the database's triggers refuse a row
 * that points across households. Plus the migration that introduced
 * households, which had to move a live garden without losing a row of it.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { kaffirLimeProposal } from '@/lib/ai/fixtures';
import { actAs } from '@/lib/auth/testing';
import { asHouseholdId, type HouseholdId } from './tenancy';
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

beforeEach(async () => {
	garden?.cleanup();
	garden = await createTempGarden();
	return () => garden.cleanup();
});

const TRIGGERS = [
	'environment',
	'plant_type',
	'planting',
	'care_rule',
	'care_log',
	'ai_proposal',
	'ai_call',
].flatMap((t) => [
	`${t}_household_insert`,
	`${t}_household_update`,
	`${t}_household_fixed`,
]);

async function modules() {
	vi.resetModules();
	const client = await import('./client');
	const seed = await import('@/db/seed/seed');
	const schema = await import('./schema');
	return { db: client.db, seed, schema };
}

function form(fields: Record<string, string | string[]>): FormData {
	const f = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		for (const v of Array.isArray(value) ? value : [value]) f.append(key, v);
	}
	return f;
}

/** Runs an action and swallows the redirect some of them end with. */
async function attempt(fn: () => Promise<unknown>): Promise<unknown> {
	try {
		return await fn();
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('REDIRECT:')) return;
		throw error;
	}
}

describe('the schema', () => {
	it('has every tenancy trigger after migrating', async () => {
		const { db } = await modules();
		const rows = await db.all<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'trigger'",
		);
		const names = rows.map((r) => r.name);
		for (const trigger of TRIGGERS) expect(names).toContain(trigger);
	});

	it('gives an empty database no household at all', async () => {
		const { db, schema } = await modules();
		expect(await db.select().from(schema.household).all()).toHaveLength(0);
	});

	it('makes the Pink Palace household 1 in an empty database', async () => {
		const { db, seed } = await modules();
		const report = await seed.seedGarden(db);
		// The tests' GARDEN constant depends on this.
		expect(report.householdId).toBe(GARDEN);
	});
});

/** Drizzle wraps the driver's error; the trigger's own words are its cause. */
async function refusal(write: Promise<unknown>): Promise<string> {
	try {
		await write;
	} catch (error) {
		const cause = error instanceof Error ? error.cause : undefined;
		return String(cause instanceof Error ? cause.message : error);
	}
	return 'not refused';
}

describe('the triggers', () => {
	it('refuse a planting that points into another garden', async () => {
		const { db, seed, schema } = await modules();
		await seed.seedGarden(db);
		const friends = await seed.createSeededHousehold(db, 'Friends', 'starter');

		const theirBed = await db
			.select()
			.from(schema.environment)
			.where(eq(schema.environment.householdId, friends))
			.get();
		const ourLemon = await db
			.select()
			.from(schema.plantType)
			.where(
				and(
					eq(schema.plantType.householdId, GARDEN),
					eq(schema.plantType.slug, 'lemon'),
				),
			)
			.get();
		if (!theirBed || !ourLemon) throw new Error('missing fixtures');

		expect(
			await refusal(
				db
					.insert(schema.planting)
					.values({
						householdId: friends,
						plantTypeId: ourLemon.id,
						environmentId: theirBed.id,
						label: 'A borrowed lemon',
					})
					.run(),
			),
		).toMatch(/cross-household reference in planting/);
	});

	it('refuse moving a row to another household', async () => {
		const { db, seed, schema } = await modules();
		await seed.seedGarden(db);
		const friends = await seed.createSeededHousehold(db, 'Friends', 'starter');

		expect(
			await refusal(
				db
					.update(schema.plantType)
					.set({ householdId: friends })
					.where(eq(schema.plantType.householdId, GARDEN))
					.run(),
			),
		).toMatch(/cannot move to another household/);
	});
});

describe('a new household', () => {
	it('starts with the vegetables and a bed, and none of the orchard', async () => {
		const { db, seed, schema } = await modules();
		const hid = await seed.createSeededHousehold(db, 'Friends', 'starter');

		const places = await db
			.select({ slug: schema.environment.slug })
			.from(schema.environment)
			.where(eq(schema.environment.householdId, hid))
			.all();
		expect(places.map((p) => p.slug)).toEqual(['bed-1']);

		const plants = await db
			.select({ category: schema.plantType.category })
			.from(schema.plantType)
			.where(eq(schema.plantType.householdId, hid))
			.all();
		expect(plants.length).toBeGreaterThan(0);
		expect(plants.every((p) => p.category !== 'fruit_tree')).toBe(true);

		const growing = await db
			.select()
			.from(schema.planting)
			.where(eq(schema.planting.householdId, hid))
			.all();
		expect(growing).toHaveLength(0);
	});

	it('comes out exactly as a re-seed would leave it', async () => {
		const { db, seed, schema } = await modules();
		const hid = await seed.createSeededHousehold(db, 'Friends', 'starter');

		const shape = async () => ({
			places: await db
				.select({
					slug: schema.environment.slug,
					kind: schema.environment.kind,
					name: schema.environment.name,
				})
				.from(schema.environment)
				.where(eq(schema.environment.householdId, hid))
				.orderBy(schema.environment.slug)
				.all(),
			plants: await db
				.select({
					slug: schema.plantType.slug,
					commonName: schema.plantType.commonName,
					sourceRef: schema.plantType.sourceRef,
				})
				.from(schema.plantType)
				.where(eq(schema.plantType.householdId, hid))
				.orderBy(schema.plantType.slug)
				.all(),
			rules: (
				await db
					.select({
						plant: schema.plantType.slug,
						action: schema.careRule.action,
						monthMask: schema.careRule.monthMask,
						cadence: schema.careRule.cadence,
						altGroup: schema.careRule.altGroup,
						sourceRef: schema.careRule.sourceRef,
					})
					.from(schema.careRule)
					.innerJoin(
						schema.plantType,
						eq(schema.careRule.plantTypeId, schema.plantType.id),
					)
					.where(eq(schema.careRule.householdId, hid))
					.all()
			)
				.map((r) => JSON.stringify(r))
				.sort(),
		});

		const bulk = await shape();
		const report = await seed.seedHousehold(db, hid, 'starter');
		expect(report.environments).toBe(0);
		expect(report.plantTypes).toBe(0);
		expect(await shape()).toEqual(bulk);
	});
});

describe('one household acting on another', () => {
	/**
	 * Two gardens, and a few things in the second worth stealing: a sowing,
	 * a picking, a proposal, and a plant and a bed with names only it has.
	 */
	async function twoGardens() {
		const mods = await modules();
		const { db, seed, schema } = mods;
		await seed.seedGarden(db);
		const theirs = await seed.createSeededHousehold(db, 'Friends', 'starter');

		const theirBed = await db
			.select()
			.from(schema.environment)
			.where(eq(schema.environment.householdId, theirs))
			.get();
		const theirTomato = await db
			.select()
			.from(schema.plantType)
			.where(
				and(
					eq(schema.plantType.householdId, theirs),
					eq(schema.plantType.slug, 'tomato'),
				),
			)
			.get();
		if (!theirBed || !theirTomato) throw new Error('missing fixtures');

		const secret = await db
			.insert(schema.plantType)
			.values({ householdId: theirs, slug: 'only-theirs', commonName: 'Secret' })
			.returning()
			.get();
		const theirPlanting = await db
			.insert(schema.planting)
			.values({
				householdId: theirs,
				plantTypeId: theirTomato.id,
				environmentId: theirBed.id,
				label: 'Their tomato',
				sownOn: '2026-09-01',
			})
			.returning()
			.get();
		const theirRules = await db
			.select()
			.from(schema.careRule)
			.where(eq(schema.careRule.plantTypeId, theirTomato.id))
			.all();
		const theirLog = await db
			.insert(schema.careLog)
			.values({
				householdId: theirs,
				plantingId: theirPlanting.id,
				action: 'harvest',
				seasonYear: 2026,
				completedOn: '2026-10-01',
			})
			.returning()
			.get();

		actAs({ householdId: theirs });
		const proposals = await import('@/lib/ai/proposals');
		const proposalId = await proposals.startProposal(theirs, 'Kaffir lime');
		await proposals.finishProposal(theirs, proposalId, {
			proposal: kaffirLimeProposal,
			notes: 'notes',
			citations: [],
		});
		actAs({ householdId: GARDEN });

		return {
			...mods,
			theirs,
			theirBed,
			theirTomato,
			secret,
			theirPlanting,
			theirRules,
			theirLog,
			proposalId,
		};
	}

	/** Everything the second household has, as one comparable value. */
	async function everythingOf(
		db: Awaited<ReturnType<typeof modules>>['db'],
		schema: Awaited<ReturnType<typeof modules>>['schema'],
		hid: HouseholdId,
	) {
		const tables = [
			schema.environment,
			schema.plantType,
			schema.planting,
			schema.careRule,
			schema.careLog,
			schema.aiProposal,
			schema.aiCall,
		];
		return Promise.all(
			tables.map((t) =>
				db.select().from(t).where(eq(t.householdId, hid)).orderBy(t.id).all(),
			),
		);
	}

	it('changes nothing in the other garden, whatever ids it is handed', async () => {
		const g = await twoGardens();
		const before = await everythingOf(g.db, g.schema, g.theirs);

		const beds = await import('@/actions/beds');
		const care = await import('@/actions/care');
		const log = await import('@/actions/log');
		const plants = await import('@/actions/plants');
		const research = await import('@/actions/research');
		const rules = await import('@/actions/rules');

		const planting = String(g.theirPlanting.id);
		const tomato = String(g.theirTomato.id);
		const bed = String(g.theirBed.id);
		const ruleIds = g.theirRules.map((r) => r.id).join(',');
		const anyRule = String(g.theirRules[0]?.id ?? 1);

		// Some of these answer "no such plant"; some quietly match nothing. Either
		// is fine. What is not fine is the other garden changing, and the
		// snapshot at the end is what says whether it did.
		const attempts = [
			await care.completeTask(
				null,
				form({ plantingId: planting, ruleId: anyRule, occurrenceKey: '2026-09' }),
			),
			await care.logHarvest(null, form({ plantingId: planting, ruleId: anyRule })),
			await care.undoCompletion(null, form({ logId: String(g.theirLog.id) })),
			await beds.sowInBed(null, form({ environmentId: bed, plantTypeId: tomato })),
			await beds.clearFromBed(null, form({ plantingId: planting })),
			await plants.updatePlantType(
				null,
				form({
					plantTypeId: tomato,
					commonName: 'Mine now',
					category: 'vegetable',
					lifecycle: 'annual',
				}),
			),
			await plants.markReviewed(null, form({ plantTypeId: tomato })),
			await plants.createPlanting(
				null,
				form({ plantTypeId: tomato, environmentId: bed, label: 'Sneaky' }),
			),
			await plants.setPlantingStatus(
				null,
				form({ plantingId: planting, status: 'dead' }),
			),
			await rules.saveRule(
				null,
				form({
					plantTypeId: tomato,
					action: 'prune',
					months: ['6'],
					cadence: 'monthly',
				}),
			),
			await rules.deleteRule(
				null,
				form({ plantTypeId: tomato, replacing: ruleIds, action: 'sow' }),
			),
			await attempt(() =>
				research.acceptProposal(
					null,
					form({ proposalId: String(g.proposalId), accept: ['0', '1'] }),
				),
			),
			await research.rejectProposal(
				null,
				form({ proposalId: String(g.proposalId) }),
			),
		];

		expect(attempts).toHaveLength(13);

		// Our own rule ids, with their plant: the rule ids must not reach theirs.
		const ourLemon = await g.db
			.select()
			.from(g.schema.plantType)
			.where(
				and(
					eq(g.schema.plantType.householdId, GARDEN),
					eq(g.schema.plantType.slug, 'lemon'),
				),
			)
			.get();
		await rules.deleteRule(
			null,
			form({
				plantTypeId: String(ourLemon?.id),
				replacing: ruleIds,
				action: 'sow',
			}),
		);

		// A sentence naming their planting writes nothing for it.
		const committed = await log.commitLog(
			null,
			form({
				entries: JSON.stringify([
					{
						plantingId: g.theirPlanting.id,
						action: 'note',
						completedOn: '2026-10-02',
					},
				]),
			}),
		);
		expect(committed).toEqual({ ok: true, written: 0 });

		expect(await everythingOf(g.db, g.schema, g.theirs)).toEqual(before);
	});

	it('cannot read the other garden by slug or id', async () => {
		const g = await twoGardens();
		const plant = await import('./queries/plant');
		const bedsQ = await import('./queries/beds');
		const proposals = await import('@/lib/ai/proposals');
		const tools = await import('@/lib/ai/ask/tools');

		expect(await plant.getPlant(GARDEN, 'only-theirs')).toBeNull();
		expect(await proposals.getProposal(GARDEN, g.proposalId)).toBeNull();
		expect(await plant.getHistory(GARDEN, g.theirPlanting.id)).toEqual([]);
		expect(await bedsQ.getBedHistory(GARDEN, g.theirBed.id)).toEqual([]);
		expect(await tools.plantSchedule(GARDEN, 'only-theirs')).toHaveProperty(
			'error',
		);

		const ours = await plant.listPlants(GARDEN);
		expect(ours.some((p) => p.slug === 'only-theirs')).toBe(false);
		const places = await bedsQ.listPlaces(GARDEN);
		expect(places.some((p) => p.id === g.theirBed.id)).toBe(false);
		const summary = await tools.gardenSummary(GARDEN);
		expect(summary.plantings.some((p) => p.label === 'Their tomato')).toBe(false);

		// And the other way round: they see their own, and none of ours.
		const theirs = await plant.listPlants(g.theirs);
		expect(theirs.some((p) => p.slug === 'only-theirs')).toBe(true);
		expect(theirs.some((p) => p.slug === 'lemon')).toBe(false);
	});
});

describe('the migration that introduced households', () => {
	/**
	 * A garden as it was before households: migrated to 0003 only, then
	 * filled in by hand the way the old seed and a season of use left it.
	 */
	async function oldGarden() {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figgy-old-'));
		const folder = path.join(dir, 'migrations');
		fs.mkdirSync(path.join(folder, 'meta'), { recursive: true });
		const journal = JSON.parse(
			fs.readFileSync('db/migrations/meta/_journal.json', 'utf8'),
		);
		const before = journal.entries.filter((e: { idx: number }) => e.idx <= 3);
		for (const entry of before) {
			fs.copyFileSync(
				`db/migrations/${entry.tag}.sql`,
				path.join(folder, `${entry.tag}.sql`),
			);
		}
		fs.writeFileSync(
			path.join(folder, 'meta', '_journal.json'),
			JSON.stringify({ ...journal, entries: before }),
		);

		const url = `file:${path.join(dir, 'garden.db')}`;
		const client = createClient({ url });
		await migrate(drizzle(client), { migrationsFolder: folder });
		await client.batch(
			[
				"INSERT INTO environment (id, slug, kind, name) VALUES (1, 'orchard', 'orchard', 'The Orchard'), (2, 'bed-1', 'bed', 'Bed 1')",
				"INSERT INTO plant_type (id, slug, common_name, user_modified_at) VALUES (1, 'lemon', 'Lemon', NULL), (2, 'fig', 'Fig', '2026-09-20')",
				"INSERT INTO planting (id, plant_type_id, environment_id, label) VALUES (1, 1, 1, 'Lemon'), (2, 2, 1, 'Fig #1'), (3, 2, 1, 'Fig #2')",
				"INSERT INTO care_rule (id, plant_type_id, action, month_mask, source) VALUES (1, 1, 'prune', 128, 'seed'), (2, 1, 'fertilise', 256, 'seed'), (3, 2, 'harvest', 3, 'user')",
				"INSERT INTO care_log (planting_id, care_rule_id, action, season_year, occurrence_key, completed_on) VALUES (1, 1, 'prune', 2026, '2026-w8', '2026-08-14'), (2, NULL, 'harvest', 2026, NULL, '2026-02-01')",
				"INSERT INTO ai_proposal (id, query, model, plant_type_id, status) VALUES (1, 'Fig', 'claude-opus-5', 2, 'accepted')",
				"INSERT INTO ai_call (proposal_id, purpose, model, cost_cents) VALUES (1, 'research', 'claude-opus-5', 12.5)",
				"INSERT INTO meta (key, value) VALUES ('seed_version', '2026-09-25.2'), ('last_backup_at', '2026-09-28T10:00:00Z'), ('weather.v2', '{}')",
			],
			'write',
		);
		client.close();
		return { dir, url };
	}

	it('moves every row into the Pink Palace and loses none of them', async () => {
		const { dir, url } = await oldGarden();
		const client = createClient({ url });
		const counts = async () =>
			Object.fromEntries(
				await Promise.all(
					[
						'environment',
						'plant_type',
						'planting',
						'care_rule',
						'care_log',
						'ai_proposal',
						'ai_call',
					].map(async (t) => [
						t,
						Number(
							(await client.execute(`SELECT count(*) AS n FROM ${t}`)).rows[0]?.n,
						),
					]),
				),
			);
		const before = await counts();

		await migrate(drizzle(client), { migrationsFolder: './db/migrations' });

		expect(await counts()).toEqual(before);
		const homes = (await client.execute('SELECT * FROM household')).rows;
		expect(homes).toHaveLength(1);
		expect(homes[0]).toMatchObject({
			id: 1,
			name: 'Pink Palace',
			seed_profile: 'pink-palace',
			seed_version: '2026-09-25.2',
		});
		for (const t of Object.keys(before)) {
			const stray = await client.execute(
				`SELECT count(*) AS n FROM ${t} WHERE household_id IS NOT 1`,
			);
			expect(Number(stray.rows[0]?.n), t).toBe(0);
		}
		// What the old rows pointed at, they still point at.
		const log = await client.execute(
			"SELECT care_rule_id FROM care_log WHERE occurrence_key = '2026-w8'",
		);
		expect(log.rows[0]?.care_rule_id).toBe(1);
		// Edits survive, so the seed still leaves them alone.
		const fig = await client.execute(
			"SELECT user_modified_at FROM plant_type WHERE slug = 'fig'",
		);
		expect(fig.rows[0]?.user_modified_at).toBe('2026-09-20');
		// The site-wide keys stay; the ones that moved or retired go.
		const keys = (
			await client.execute('SELECT key FROM meta ORDER BY key')
		).rows.map((r) => r.key);
		expect(keys).toEqual(['weather.v2']);
		expect((await client.execute('PRAGMA foreign_key_check')).rows).toHaveLength(0);

		client.close();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it('then re-seeds the Pink Palace without duplicating anything', async () => {
		const { dir, url } = await oldGarden();
		const client = createClient({ url });
		await migrate(drizzle(client), { migrationsFolder: './db/migrations' });
		client.close();

		process.env.TURSO_DATABASE_URL = url;
		const { db, seed, schema } = await modules();
		const reports = await seed.seedAll(db);
		expect(reports).toHaveLength(1);
		expect(reports[0]?.householdId).toBe(asHouseholdId(1));

		const lemons = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'lemon'))
			.all();
		expect(lemons).toHaveLength(1);
		const orchards = await db
			.select()
			.from(schema.environment)
			.where(eq(schema.environment.slug, 'orchard'))
			.all();
		expect(orchards).toHaveLength(1);

		db.$client.close();
		fs.rmSync(dir, { recursive: true, force: true });
	});
});
