/**
 * What happens after Claude answers.
 *
 * The network call itself is not exercised here - these cover everything
 * downstream of it, which is where a wrong answer would actually do damage:
 * what the schema accepts, what accepting writes, and what rejecting does not.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTempGarden, type TempGarden } from '@/lib/db/testing';
import { monthsFromMask } from '@/lib/schedule/months';
import { kaffirLimeProposal } from './fixtures';
import { plantProposalSchema } from './schema';
import { costInCents } from './usage';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({
	// Next's redirect throws to unwind the request; here it just records.
	redirect: (url: string) => {
		throw new Error(`REDIRECT:${url}`);
	},
}));

let garden: TempGarden;

async function freshModules() {
	vi.resetModules();
	const client = await import('@/lib/db/client');
	const { seedGarden } = await import('@/db/seed/seed');
	const schema = await import('@/lib/db/schema');
	const research = await import('@/actions/research');
	const proposals = await import('./proposals');
	const queries = await import('@/lib/db/queries/plant');
	return { db: client.db, seedGarden, schema, research, proposals, queries };
}

function form(fields: Record<string, string | string[]>): FormData {
	const f = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		for (const v of Array.isArray(value) ? value : [value]) f.append(key, v);
	}
	return f;
}

/** acceptProposal finishes by redirecting, which is not an error. */
async function runExpectingRedirect(fn: () => Promise<unknown>): Promise<string> {
	try {
		await fn();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.startsWith('REDIRECT:')) return message.slice('REDIRECT:'.length);
		throw error;
	}
	throw new Error('Expected a redirect and did not get one');
}

beforeEach(() => {
	garden?.cleanup();
	garden = createTempGarden();
	return () => garden.cleanup();
});

describe('the proposal schema', () => {
	it('accepts a proposal shaped the way the model returns one', () => {
		expect(plantProposalSchema.safeParse(kaffirLimeProposal).success).toBe(true);
	});

	it('rejects a month that is not a month', () => {
		const bad = structuredClone(kaffirLimeProposal);
		bad.rules[0].months = [13];
		expect(plantProposalSchema.safeParse(bad).success).toBe(false);
	});

	it('rejects a window with no months at all', () => {
		const bad = structuredClone(kaffirLimeProposal);
		bad.rules[0].months = [];
		expect(plantProposalSchema.safeParse(bad).success).toBe(false);
	});

	it('rejects an invented action', () => {
		const bad = structuredClone(kaffirLimeProposal);
		// @ts-expect-error deliberately wrong
		bad.rules[0].action = 'mulch';
		expect(plantProposalSchema.safeParse(bad).success).toBe(false);
	});
});

describe('accepting a proposal', () => {
	async function readyProposal() {
		const mods = await freshModules();
		mods.seedGarden(mods.db);
		const id = mods.proposals.startProposal('Kaffir lime');
		mods.proposals.finishProposal(id, {
			proposal: kaffirLimeProposal,
			notes: 'Research notes here.',
			citations: [{ url: 'https://example.org/citrus-care', title: 'Citrus care' }],
		});
		return { ...mods, id };
	}

	it('creates the plant and the windows that were ticked', async () => {
		const { db, schema, research, queries, id } = await readyProposal();

		const to = await runExpectingRedirect(() =>
			research.acceptProposal(
				null,
				form({ proposalId: String(id), accept: ['0', '1', '2', '3'] }),
			),
		);
		expect(to).toBe('/plants/kaffir-lime');

		const plant = db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'kaffir-lime'))
			.get();
		expect(plant?.commonName).toBe('Kaffir lime');
		expect(plant?.source).toBe('ai');
		// Accepting it is the review, so it is not flagged as needing one.
		expect(plant?.needsReview).toBe(false);

		const rules = queries.getEditableRules(plant?.id ?? 0);
		expect(rules).toHaveLength(4);

		// "August or September" becomes two rules sharing a group, which the
		// editor shows as one job with a choice.
		const prune = rules.find((r) => r.action === 'prune');
		expect(prune?.alternatives).toBe(true);
		expect(prune?.ruleIds).toHaveLength(2);
		expect(monthsFromMask(prune?.monthMask ?? 0)).toEqual([8, 9]);
		expect(prune?.cadence).toBe('once_in_window');

		// A list of months stays one rule.
		const feed = rules.find((r) => r.action === 'fertilise');
		expect(feed?.alternatives).toBe(false);
		expect(monthsFromMask(feed?.monthMask ?? 0)).toEqual([3, 9, 12]);

		// Harvest stays a season.
		expect(rules.find((r) => r.action === 'harvest')?.cadence).toBe('continuous');
	});

	it('takes only what was ticked', async () => {
		const { db, schema, research, queries, id } = await readyProposal();

		// Leave out the watering one, whose own reasoning admits it was guessed.
		await runExpectingRedirect(() =>
			research.acceptProposal(
				null,
				form({ proposalId: String(id), accept: ['0', '1'] }),
			),
		);

		const plant = db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'kaffir-lime'))
			.get();
		const actions = queries.getEditableRules(plant?.id ?? 0).map((r) => r.action);
		expect(actions.sort()).toEqual(['fertilise', 'prune']);
	});

	it('records where each window came from', async () => {
		const { db, schema, research, id } = await readyProposal();
		await runExpectingRedirect(() =>
			research.acceptProposal(
				null,
				form({ proposalId: String(id), accept: ['0'] }),
			),
		);

		const rule = db.select().from(schema.careRule).all().at(-1);
		expect(rule?.source).toBe('ai');
		expect(rule?.sourceRef).toContain('claude-opus-5');
		expect(rule?.sourceRef).toContain('example.org');
	});

	it('plants one when asked, and not otherwise', async () => {
		const { db, schema, research, id } = await readyProposal();
		const orchard = db
			.select()
			.from(schema.environment)
			.where(eq(schema.environment.slug, 'orchard'))
			.get();

		await runExpectingRedirect(() =>
			research.acceptProposal(
				null,
				form({
					proposalId: String(id),
					accept: ['0'],
					plantAs: 'Kaffir lime by the tank',
					environmentId: String(orchard?.id),
				}),
			),
		);

		const planted = db
			.select()
			.from(schema.planting)
			.all()
			.find((p) => p.label === 'Kaffir lime by the tank');
		expect(planted).toBeDefined();
	});

	it('feeds accepted windows straight into the schedule', async () => {
		const { db, schema, research, id } = await readyProposal();
		const orchard = db
			.select()
			.from(schema.environment)
			.where(eq(schema.environment.slug, 'orchard'))
			.get();

		await runExpectingRedirect(() =>
			research.acceptProposal(
				null,
				form({
					proposalId: String(id),
					accept: ['0', '1'],
					plantAs: 'Kaffir lime',
					environmentId: String(orchard?.id),
				}),
			),
		);

		const { getDashboard } = await import('@/lib/db/queries/garden');
		const board = getDashboard('2026-09-15');
		expect(
			board.due.some(
				(t) =>
					t.context.label === 'Kaffir lime' &&
					t.occurrence.rule.action === 'fertilise',
			),
		).toBe(true);
	});

	it('survives a re-seed', async () => {
		const { db, seedGarden, schema, research, queries, id } = await readyProposal();
		await runExpectingRedirect(() =>
			research.acceptProposal(
				null,
				form({ proposalId: String(id), accept: ['0'] }),
			),
		);

		seedGarden(db);

		const plant = db
			.select()
			.from(schema.plantType)
			.where(eq(schema.plantType.slug, 'kaffir-lime'))
			.get();
		expect(plant).toBeDefined();
		expect(queries.getEditableRules(plant?.id ?? 0)).toHaveLength(1);
	});

	it('will not be accepted twice', async () => {
		const { research, id } = await readyProposal();
		await runExpectingRedirect(() =>
			research.acceptProposal(
				null,
				form({ proposalId: String(id), accept: ['0'] }),
			),
		);

		const second = await research.acceptProposal(
			null,
			form({ proposalId: String(id), accept: ['0'] }),
		);
		expect(second).toEqual({
			ok: false,
			error: 'That one has already been accepted.',
		});
	});
});

describe('rejecting a proposal', () => {
	it('writes nothing to the schedule', async () => {
		const mods = await freshModules();
		mods.seedGarden(mods.db);
		const before = mods.db.select().from(mods.schema.careRule).all().length;

		const id = mods.proposals.startProposal('Kaffir lime');
		mods.proposals.finishProposal(id, {
			proposal: kaffirLimeProposal,
			notes: '',
			citations: [],
		});

		expect(
			await mods.research.rejectProposal(null, form({ proposalId: String(id) })),
		).toEqual({ ok: true });

		expect(mods.db.select().from(mods.schema.careRule).all()).toHaveLength(before);
		expect(mods.db.select().from(mods.schema.plantType).all()).toHaveLength(11);
		expect(mods.proposals.getProposal(id)?.status).toBe('rejected');
	});
});

describe('what it costs', () => {
	it('prices a lookup from the tokens it used', () => {
		// A realistic research pass: a lot of search results in, a page out.
		const cents = costInCents({
			input_tokens: 45_000,
			output_tokens: 3_000,
			cache_read_input_tokens: 0,
			cache_creation_input_tokens: 400,
		});
		expect(cents).toBeCloseTo(30.25, 1);
	});

	it('charges a tenth for cached input', () => {
		const cold = costInCents({ input_tokens: 10_000 });
		const warm = costInCents({ cache_read_input_tokens: 10_000 });
		expect(warm).toBeCloseTo(cold / 10, 6);
	});
});
