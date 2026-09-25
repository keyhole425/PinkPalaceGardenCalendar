/**
 * The seed's promise: re-running it never undoes your work.
 *
 * This is the subtlest rule in figgy and the easiest to break, so it is tested
 * against a real database rather than reasoned about.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { monthsFromMask } from '@/lib/schedule/months';
import { createTempGarden, type TempGarden } from './testing';

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

beforeEach(() => {
	garden?.cleanup();
	garden = createTempGarden();
	return () => garden.cleanup();
});

describe('seeding', () => {
	it('is idempotent', async () => {
		const { db, seedGarden, schema } = await freshModules();

		const first = seedGarden(db);
		expect(first.plantTypes).toBe(11);
		expect(first.plantings).toBe(13);
		expect(first.rules).toBe(36);

		const second = seedGarden(db);
		expect(second.plantTypes).toBe(0);
		expect(second.plantings).toBe(0);

		// The count is what matters: re-seeding must not double anything up.
		expect(db.select().from(schema.careRule).all()).toHaveLength(36);
		expect(db.select().from(schema.planting).all()).toHaveLength(13);
	});

	it('leaves an edited rule alone, and does not put its own back', async () => {
		const { db, seedGarden, schema, rules, queries } = await freshModules();
		seedGarden(db);

		const lemon = db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'lemon'))
			.get();
		if (!lemon) throw new Error('no lemon');

		const prune = queries
			.getEditableRules(lemon.id)
			.find((r) => r.action === 'prune');
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

		seedGarden(db);

		const after = queries
			.getEditableRules(lemon.id)
			.filter((r) => r.action === 'prune');
		expect(after).toHaveLength(1);
		expect(after[0].alternatives).toBe(false);
		expect(after[0].edited).toBe(true);
		// September only, and August has not crept back in.
		expect(monthsFromMask(after[0].monthMask)).toEqual([9]);
	});

	it('keeps a removed rule removed', async () => {
		const { db, seedGarden, schema, rules, queries } = await freshModules();
		seedGarden(db);

		const cherry = db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'cherry'))
			.get();
		if (!cherry) throw new Error('no cherry');

		const prune = queries
			.getEditableRules(cherry.id)
			.find((r) => r.action === 'prune');
		if (!prune) throw new Error('no prune rule');

		await rules.deleteRule(
			null,
			form({
				plantTypeId: String(cherry.id),
				replacing: prune.ruleIds.join(','),
				action: 'prune',
			}),
		);

		seedGarden(db);

		expect(
			queries.getEditableRules(cherry.id).filter((r) => r.action === 'prune'),
		).toHaveLength(0);
		expect(queries.getRemovedActions(cherry.id)).toContain('prune');
	});

	it('keeps the rest of an action when one of its rules is removed', async () => {
		const { db, seedGarden, schema, rules, queries } = await freshModules();
		seedGarden(db);

		// The cumquat has two feeds: a February-or-March one, and September.
		const cumquat = db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'cumquat'))
			.get();
		if (!cumquat) throw new Error('no cumquat');

		const feeds = queries
			.getEditableRules(cumquat.id)
			.filter((r) => r.action === 'fertilise');
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

		seedGarden(db);

		// September survives. Without adoption the re-seed would have taken it
		// as its own and deleted it, having been told feeding is now yours.
		const after = queries
			.getEditableRules(cumquat.id)
			.filter((r) => r.action === 'fertilise');
		expect(after).toHaveLength(1);
		expect(monthsFromMask(after[0].monthMask)).toEqual([9]);
		// It still says where it came from.
		expect(after[0].source).toBe('seed');
	});

	it('leaves edited plant details alone', async () => {
		const { db, seedGarden, schema, plants } = await freshModules();
		seedGarden(db);

		const fig = db
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

		const report = seedGarden(db);
		expect(report.leftAlone).toContain('fig');

		const after = db
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
		seedGarden(db);

		const plum = db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'plum'))
			.get();
		if (!plum) throw new Error('no plum');

		// The spreadsheet never said when to prune a plum.
		expect(
			queries.getEditableRules(plum.id).some((r) => r.action === 'prune'),
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

		const prune = queries
			.getEditableRules(plum.id)
			.find((r) => r.action === 'prune');
		expect(prune?.alternatives).toBe(true);
		expect(monthsFromMask(prune?.monthMask ?? 0)).toEqual([6, 7]);
		// Alternatives are a once-a-season job whatever the form said.
		expect(prune?.cadence).toBe('once_in_window');
	});

	it('refuses a single month dressed up as a choice', async () => {
		const { db, seedGarden, schema, rules } = await freshModules();
		seedGarden(db);
		const plum = db
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
		seedGarden(db);
		const plum = db
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
		const board = getDashboard('2026-07-15');
		expect(
			board.due.some(
				(t) =>
					t.context.plantName === 'Plum' && t.occurrence.rule.action === 'prune',
			),
		).toBe(true);
	});
});
