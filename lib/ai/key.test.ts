/**
 * A household's own Anthropic key.
 *
 * The SDK is replaced with a stand-in that accepts one key and refuses the
 * rest, so nothing here reaches the network. What is tested is figgy's side:
 * who may set a key, that it is sealed and bound to its household, that it
 * never comes back out, and that no key in the environment is ever spent.
 */
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actAs } from '@/lib/auth/testing';
import { createTempGarden, GARDEN, type TempGarden } from '@/lib/db/testing';

const GOOD_KEY = 'sk-ant-api03-the-good-one-WXYZ';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('@anthropic-ai/sdk', () => {
	class APIError extends Error {
		status = 500;
	}
	class FakeAnthropic {
		static APIError = APIError;
		static AuthenticationError = class extends APIError {};
		static PermissionDeniedError = class extends APIError {};
		static RateLimitError = class extends APIError {};
		static APIConnectionError = class extends APIError {};
		options: { apiKey?: string | null };
		constructor(options: { apiKey?: string | null }) {
			this.options = options;
		}
		models = {
			list: async () => {
				if (this.options.apiKey === GOOD_KEY) return { data: [] };
				throw new Error('That key was refused.');
			},
		};
	}
	return { default: FakeAnthropic };
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
	const ai = await import('./client');
	const actions = await import('@/actions/ai-key');
	await seed.seedGarden(client.db);
	// The person actAs() signs in as by default, so the key has someone to
	// have been saved by.
	await client.db
		.insert(schema.user)
		.values({ id: 'test-user', name: 'Tester', email: 'tester@figgy.test' })
		.run();
	return { db: client.db, seed, schema, ai, actions };
}

function form(fields: Record<string, string> = {}): FormData {
	const f = new FormData();
	for (const [key, value] of Object.entries(fields)) f.append(key, value);
	return f;
}

describe('a household with no key', () => {
	it('has looking things up switched off', async () => {
		const { ai } = await modules();
		expect(await ai.aiAvailable(GARDEN)).toBe(false);
		await expect(ai.anthropicFor(GARDEN)).rejects.toThrow(ai.NoKeyError);
	});

	it('never borrows a key from the environment', async () => {
		const { ai } = await modules();
		process.env.ANTHROPIC_API_KEY = GOOD_KEY;
		try {
			expect(await ai.aiAvailable(GARDEN)).toBe(false);
			await expect(ai.anthropicFor(GARDEN)).rejects.toThrow(ai.NoKeyError);
		} finally {
			delete process.env.ANTHROPIC_API_KEY;
		}
	});
});

describe('saving a key', () => {
	it('is for household admins only', async () => {
		const { db, schema, actions } = await modules();
		actAs({ householdId: GARDEN, role: 'member' });
		const result = await actions.saveAiKey(null, form({ apiKey: GOOD_KEY }));
		expect(result.ok).toBe(false);
		expect((await actions.removeAiKey(null, form())).ok).toBe(false);
		expect(await db.select().from(schema.householdAiCredential).all()).toHaveLength(
			0,
		);
	});

	it('refuses something that is not an Anthropic key, without trying it', async () => {
		const { actions } = await modules();
		const result = await actions.saveAiKey(
			null,
			form({ apiKey: 'sk-proj-openai' }),
		);
		expect(result).toMatchObject({ ok: false });
	});

	it('refuses a key that Anthropic refuses, and saves nothing', async () => {
		const { db, schema, actions } = await modules();
		const result = await actions.saveAiKey(
			null,
			form({ apiKey: 'sk-ant-wrong-1234' }),
		);
		expect(result.ok).toBe(false);
		expect(await db.select().from(schema.householdAiCredential).all()).toHaveLength(
			0,
		);
	});

	it('seals a good one, keeps only its last four in the clear, and switches on', async () => {
		const { db, schema, ai, actions } = await modules();
		const result = await actions.saveAiKey(null, form({ apiKey: GOOD_KEY }));
		expect(result.ok).toBe(true);
		expect(JSON.stringify(result)).not.toContain(GOOD_KEY);

		const row = await db.select().from(schema.householdAiCredential).get();
		expect(row?.keyLast4).toBe('WXYZ');
		expect(JSON.stringify(row)).not.toContain(GOOD_KEY);

		expect(await ai.aiAvailable(GARDEN)).toBe(true);
		const client = (await ai.anthropicFor(GARDEN)) as unknown as {
			options: { apiKey: string; authToken: null };
		};
		expect(client.options.apiKey).toBe(GOOD_KEY);
		// Passed explicitly, so the SDK has no reason to look in the environment.
		expect(client.options.authToken).toBeNull();
	});

	it('does nothing for any other household', async () => {
		const { db, seed, schema, ai, actions } = await modules();
		await actions.saveAiKey(null, form({ apiKey: GOOD_KEY }));
		const other = await seed.createSeededHousehold(db, 'Elsewhere', 'starter');
		expect(await ai.aiAvailable(other)).toBe(false);

		// Even a copy of the sealed key will not open on another household's row.
		const row = await db.select().from(schema.householdAiCredential).get();
		if (!row) throw new Error('no row');
		await db
			.insert(schema.householdAiCredential)
			.values({ ...row, householdId: other })
			.run();
		await expect(ai.anthropicFor(other)).rejects.toThrow();
	});

	it('can be taken away again', async () => {
		const { ai, actions } = await modules();
		await actions.saveAiKey(null, form({ apiKey: GOOD_KEY }));
		expect((await actions.removeAiKey(null, form())).ok).toBe(true);
		expect(await ai.aiAvailable(GARDEN)).toBe(false);
	});
});

describe('research that never finished', () => {
	it('is given up on rather than left running for ever', async () => {
		const { db, schema } = await modules();
		const proposals = await import('./proposals');
		const id = await proposals.startProposal(GARDEN, 'Fig');
		await db
			.update(schema.aiProposal)
			.set({ createdAt: sql`datetime('now', '-20 minutes')` })
			.where(eq(schema.aiProposal.id, id))
			.run();
		const fresh = await proposals.startProposal(GARDEN, 'Olive');

		expect((await proposals.getProposal(GARDEN, id))?.status).toBe('failed');
		expect((await proposals.getProposal(GARDEN, fresh))?.status).toBe('running');
	});
});
