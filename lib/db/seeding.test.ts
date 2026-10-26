/**
 * The seed's promise: re-running it never undoes your work.
 *
 * This is the subtlest rule in figgy and the easiest to break, so it is tested
 * against a real database rather than reasoned about.
 */
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { monthsFromMask } from '@/lib/schedule/months';
import { createTempGarden, GARDEN, type TempGarden } from './testing';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

let garden: TempGarden;

async function freshModules() {
	vi.resetModules();
	const client = await import('./client');
	const { seedGarden } = await import('@/db/seed/seed');
	const schema = await import('./schema');
	const rules = await import('@/actions/rules');
	const plants = await import('@/actions/plants');
	const queries = await import('./queries/plant');
	return { db: client.db, seedGarden, schema, rules, plants, queries };
}

function form(fields: Record<string, string | string[]>): FormData {
	const f = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		for (const v of Array.isArray(value) ? value : [value]) f.append(key, v);
	}
	return f;
}

beforeEach(async () => {
	garden?.cleanup();
	garden = await createTempGarden();
	return () => garden.cleanup();
});

describe('seeding', () => {
	it('is idempotent', async () => {
		const { db, seedGarden, schema } = await freshModules();

		const first = await seedGarden(db);
		expect(first.plantTypes).toBeGreaterThan(0);
		expect(first.plantings).toBeGreaterThan(0);
		expect(first.rules).toBeGreaterThan(0);

		const after = {
			rules: (await db.select().from(schema.careRule).all()).length,
			plantings: (await db.select().from(schema.planting).all()).length,
			plants: (await db.select().from(schema.plantType).all()).length,
		};

		const second = await seedGarden(db);
		expect(second.plantTypes).toBe(0);
		expect(second.plantings).toBe(0);

		// Counts against the first run, not against a number written here, so
		// the test keeps working as the seed grows.
		expect(await db.select().from(schema.careRule).all()).toHaveLength(after.rules);
		expect(await db.select().from(schema.planting).all()).toHaveLength(
			after.plantings,
		);
		expect(await db.select().from(schema.plantType).all()).toHaveLength(
			after.plants,
		);
	});

	it('leaves an edited rule alone, and does not put its own back', async () => {
		const { db, seedGarden, schema, rules, queries } = await freshModules();
		await seedGarden(db);

		const lemon = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'lemon'))
			.get();
		if (!lemon) throw new Error('no lemon');

		const prune = (await queries.getEditableRules(GARDEN, lemon.id)).find(
			(r) => r.action === 'prune',
		);
		if (!prune) throw new Error('no prune rule');
		// The spreadsheet says August or September.
		expect(prune.alternatives).toBe(true);

		// You decide you only ever prune in September.
		const result = await rules.saveRule(
			null,
			form({
				plantTypeId: String(lemon.id),
				replacing: prune.ruleIds.join(','),
				action: 'prune',
				months: ['9'],
				cadence: 'once_in_window',
			}),
		);
		expect(result).toEqual({ ok: true });

		await seedGarden(db);

		const after = (await queries.getEditableRules(GARDEN, lemon.id)).filter(
			(r) => r.action === 'prune',
		);
		expect(after).toHaveLength(1);
		expect(after[0].alternatives).toBe(false);
		expect(after[0].edited).toBe(true);
		// September only, and August has not crept back in.
		expect(monthsFromMask(after[0].monthMask)).toEqual([9]);
	});

	it('keeps a removed rule removed', async () => {
		const { db, seedGarden, schema, rules, queries } = await freshModules();
		await seedGarden(db);

		const cherry = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'cherry'))
			.get();
		if (!cherry) throw new Error('no cherry');

		const prune = (await queries.getEditableRules(GARDEN, cherry.id)).find(
			(r) => r.action === 'prune',
		);
		if (!prune) throw new Error('no prune rule');

		await rules.deleteRule(
			null,
			form({
				plantTypeId: String(cherry.id),
				replacing: prune.ruleIds.join(','),
				action: 'prune',
			}),
		);

		await seedGarden(db);

		expect(
			(await queries.getEditableRules(GARDEN, cherry.id)).filter(
				(r) => r.action === 'prune',
			),
		).toHaveLength(0);
		expect(await queries.getRemovedActions(GARDEN, cherry.id)).toContain('prune');
	});

	it('keeps what was done when the rule it answered is removed', async () => {
		const { db, seedGarden, schema, rules, queries } = await freshModules();
		await seedGarden(db);
		// The local driver enforces foreign keys and would cascade on its own.
		// Hosted Turso may not, so this runs as if nothing cascades.
		await db.run(sql`PRAGMA foreign_keys = OFF`);

		const cherry = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'cherry'))
			.get();
		if (!cherry) throw new Error('no cherry');
		const tree = await db
			.select()
			.from(schema.planting)
			.where(eq(schema.planting.plantTypeId, cherry.id))
			.get();
		if (!tree) throw new Error('no cherry tree');
		const prune = (await queries.getEditableRules(GARDEN, cherry.id)).find(
			(r) => r.action === 'prune',
		);
		if (!prune) throw new Error('no prune rule');

		const [ruleId] = prune.ruleIds;
		await db
			.insert(schema.careLog)
			.values({
				householdId: GARDEN,
				plantingId: tree.id,
				careRuleId: ruleId,
				action: 'prune',
				seasonYear: 2025,
				occurrenceKey: '2025-w8',
				completedOn: '2025-08-20',
			})
			.run();

		await rules.deleteRule(
			null,
			form({
				plantTypeId: String(cherry.id),
				replacing: prune.ruleIds.join(','),
				action: 'prune',
			}),
		);

		// The pruning has to survive and let go of the rule because figgy says
		// so in code, not because the database happened to cascade.
		const logs = await db
			.select()
			.from(schema.careLog)
			.where(eq(schema.careLog.plantingId, tree.id))
			.all();
		expect(logs).toHaveLength(1);
		expect(logs[0]?.careRuleId).toBeNull();
		expect(logs[0]?.completedOn).toBe('2025-08-20');
	});

	it('keeps the rest of an action when one of its rules is removed', async () => {
		const { db, seedGarden, schema, rules, queries } = await freshModules();
		await seedGarden(db);

		// The cumquat has two feeds: a February-or-March one, and September.
		const cumquat = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'cumquat'))
			.get();
		if (!cumquat) throw new Error('no cumquat');

		const feeds = (await queries.getEditableRules(GARDEN, cumquat.id)).filter(
			(r) => r.action === 'fertilise',
		);
		expect(feeds).toHaveLength(2);

		const lateSummer = feeds.find((r) => r.alternatives);
		if (!lateSummer) throw new Error('no late summer feed');

		await rules.deleteRule(
			null,
			form({
				plantTypeId: String(cumquat.id),
				replacing: lateSummer.ruleIds.join(','),
				action: 'fertilise',
			}),
		);

		await seedGarden(db);

		// September survives. Without adoption the re-seed would have taken it
		// as its own and deleted it, having been told feeding is now yours.
		const after = (await queries.getEditableRules(GARDEN, cumquat.id)).filter(
			(r) => r.action === 'fertilise',
		);
		expect(after).toHaveLength(1);
		expect(monthsFromMask(after[0].monthMask)).toEqual([9]);
		// It still says where it came from.
		expect(after[0].source).toBe('seed');
	});

	it('leaves edited plant details alone', async () => {
		const { db, seedGarden, schema, plants } = await freshModules();
		await seedGarden(db);

		const fig = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'fig'))
			.get();
		if (!fig) throw new Error('no fig');

		await plants.updatePlantType(
			null,
			form({
				plantTypeId: String(fig.id),
				commonName: 'Fig (Black Genoa)',
				category: 'fruit_tree',
				lifecycle: 'perennial',
				notesMd: 'The one by the shed.',
			}),
		);

		const report = await seedGarden(db);
		expect(report.leftAlone).toContain('fig');

		const after = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'fig'))
			.get();
		expect(after?.commonName).toBe('Fig (Black Genoa)');
		expect(after?.notesMd).toBe('The one by the shed.');
	});
});

describe('editing rules', () => {
	it('turns chosen months into alternatives when asked', async () => {
		const { db, seedGarden, schema, rules, queries } = await freshModules();
		await seedGarden(db);

		const plum = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'plum'))
			.get();
		if (!plum) throw new Error('no plum');

		// The spreadsheet never said when to prune a plum.
		expect(
			(await queries.getEditableRules(GARDEN, plum.id)).some(
				(r) => r.action === 'prune',
			),
		).toBe(false);

		await rules.saveRule(
			null,
			form({
				plantTypeId: String(plum.id),
				action: 'prune',
				months: ['6', '7'],
				cadence: 'monthly',
				alternatives: 'on',
			}),
		);

		const prune = (await queries.getEditableRules(GARDEN, plum.id)).find(
			(r) => r.action === 'prune',
		);
		expect(prune?.alternatives).toBe(true);
		expect(monthsFromMask(prune?.monthMask ?? 0)).toEqual([6, 7]);
		// Alternatives are a once-a-season job whatever the form said.
		expect(prune?.cadence).toBe('once_in_window');
	});

	it('refuses a single month dressed up as a choice', async () => {
		const { db, seedGarden, schema, rules } = await freshModules();
		await seedGarden(db);
		const plum = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'plum'))
			.get();
		if (!plum) throw new Error('no plum');

		const result = await rules.saveRule(
			null,
			form({
				plantTypeId: String(plum.id),
				action: 'prune',
				months: ['6'],
				cadence: 'monthly',
				alternatives: 'on',
			}),
		);
		expect(result.ok).toBe(false);
	});

	it('feeds an edited rule straight into the schedule', async () => {
		const { db, seedGarden, schema, rules } = await freshModules();
		await seedGarden(db);
		const plum = await db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'plum'))
			.get();
		if (!plum) throw new Error('no plum');

		await rules.saveRule(
			null,
			form({
				plantTypeId: String(plum.id),
				action: 'prune',
				months: ['7'],
				cadence: 'once_in_window',
			}),
		);

		const { getDashboard } = await import('./queries/garden');
		const board = await getDashboard(GARDEN, '2026-07-15');
		expect(
			board.due.some(
				(t) =>
					t.context.plantName === 'Plum' && t.occurrence.rule.action === 'prune',
			),
		).toBe(true);
	});
});
