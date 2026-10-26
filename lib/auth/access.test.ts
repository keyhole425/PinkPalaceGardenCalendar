/**
 * Who may do what.
 *
 * Every server action is a public POST endpoint, whatever page it sits on, so
 * each one has to refuse a stranger on its own. The sweep below finds every
 * export of every actions module and calls it signed out; a new action that
 * forgets to check fails here without anyone having to remember to add it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTempGarden, GARDEN, type TempGarden } from '@/lib/db/testing';
import { actAs } from './testing';

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

/** Account actions are how a stranger stops being one; they take an invite instead. */
const PUBLIC_MODULES = new Set(['account.ts']);

function form(fields: Record<string, string> = {}): FormData {
	const f = new FormData();
	for (const [key, value] of Object.entries(fields)) f.append(key, value);
	return f;
}

async function modules() {
	vi.resetModules();
	const client = await import('@/lib/db/client');
	const seed = await import('@/db/seed/seed');
	const schema = await import('@/lib/db/schema');
	const invites = await import('@/lib/invites');
	const household = await import('@/actions/household');
	await seed.seedGarden(client.db);
	return { db: client.db, seed, schema, invites, household };
}

/** Makes a real person in a household, through an invite like anyone else. */
async function personIn(
	m: Awaited<ReturnType<typeof modules>>,
	householdId: number,
	email: string,
	role: 'admin' | 'member' = 'member',
) {
	const minted = await m.invites.mintInvite({
		kind: 'join_household',
		householdId: householdId as typeof GARDEN,
		role,
	});
	const spent = await m.invites.createAccountFromInvite(
		minted.url.split('/join/')[1] ?? '',
		{
			name: email.split('@')[0] ?? 'someone',
			email,
			password: 'a long enough password',
		},
	);
	if (!spent.ok) throw new Error(spent.error);
	return spent.userId;
}

describe('signed out', () => {
	it('every action sends a stranger to sign in, and writes nothing', async () => {
		const m = await modules();
		actAs({ signedIn: false });

		const dir = path.join(process.cwd(), 'actions');
		const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
		let checked = 0;
		for (const file of files) {
			if (PUBLIC_MODULES.has(file)) continue;
			const mod = (await import(
				`@/actions/${file.replace(/\.ts$/, '')}`
			)) as Record<string, unknown>;
			for (const [name, value] of Object.entries(mod)) {
				if (typeof value !== 'function') continue;
				checked++;
				await expect(
					(value as (a: null, b: FormData) => Promise<unknown>)(null, form()),
					`${file}: ${name}`,
				).rejects.toThrow('REDIRECT:/login');
			}
		}
		expect(checked).toBeGreaterThan(20);
		expect(await m.db.select().from(m.schema.invite).all()).toHaveLength(0);
	});
});

describe('a member', () => {
	it('cannot invite, rename, or change who is in the household', async () => {
		const m = await modules();
		const admin = await personIn(m, GARDEN, 'admin@example.com', 'admin');
		const member = await personIn(m, GARDEN, 'member@example.com');
		actAs({ userId: member, householdId: GARDEN, role: 'member' });

		for (const result of [
			await m.household.inviteToHousehold(null, form()),
			await m.household.renameHousehold(null, form({ name: 'Mine now' })),
			await m.household.setMemberRole(
				null,
				form({ userId: member, role: 'admin' }),
			),
			await m.household.removeMember(null, form({ userId: admin })),
			await m.household.inviteNewGarden(null, form()),
		]) {
			expect(result.ok).toBe(false);
		}
		const home = await m.db.select().from(m.schema.household).get();
		expect(home?.name).toBe('Pink Palace');
		expect(await m.db.select().from(m.schema.membership).all()).toHaveLength(2);
	});
});

describe('a household admin', () => {
	it('can invite someone in, and the link lands them in this household', async () => {
		const m = await modules();
		const admin = await personIn(m, GARDEN, 'admin@example.com', 'admin');
		actAs({ userId: admin, householdId: GARDEN, role: 'admin' });

		const result = await m.household.inviteToHousehold(
			null,
			form({ role: 'member' }),
		);
		if (!result.ok || !result.url) throw new Error('no link');
		const open = await m.invites.findOpenInvite(
			result.url.split('/join/')[1] ?? '',
		);
		expect(open).toMatchObject({ kind: 'join_household', householdId: GARDEN });
	});

	it('cannot start a new garden without being a site admin', async () => {
		const m = await modules();
		const admin = await personIn(m, GARDEN, 'admin@example.com', 'admin');
		actAs({ userId: admin, householdId: GARDEN, role: 'admin', siteAdmin: false });
		expect((await m.household.inviteNewGarden(null, form())).ok).toBe(false);

		actAs({ userId: admin, householdId: GARDEN, role: 'admin', siteAdmin: true });
		expect((await m.household.inviteNewGarden(null, form())).ok).toBe(true);
	});

	it('removes a member and their account, so they can be invited back', async () => {
		const m = await modules();
		const admin = await personIn(m, GARDEN, 'admin@example.com', 'admin');
		const member = await personIn(m, GARDEN, 'leaving@example.com');
		actAs({ userId: admin, householdId: GARDEN, role: 'admin' });

		expect(
			(await m.household.removeMember(null, form({ userId: member }))).ok,
		).toBe(true);
		expect(
			await m.db
				.select()
				.from(m.schema.user)
				.where(eq(m.schema.user.id, member))
				.get(),
		).toBeUndefined();
		expect(
			await m.db
				.select()
				.from(m.schema.account)
				.where(eq(m.schema.account.userId, member))
				.all(),
		).toHaveLength(0);

		await personIn(m, GARDEN, 'leaving@example.com');
	});

	it('cannot leave the household without an admin', async () => {
		const m = await modules();
		const admin = await personIn(m, GARDEN, 'only@example.com', 'admin');
		actAs({ userId: admin, householdId: GARDEN, role: 'admin' });

		const demoted = await m.household.setMemberRole(
			null,
			form({ userId: admin, role: 'member' }),
		);
		expect(demoted.ok).toBe(false);
		const removed = await m.household.removeMember(null, form({ userId: admin }));
		expect(removed.ok).toBe(false);
	});

	it('cannot touch anyone in another household', async () => {
		const m = await modules();
		const ours = await personIn(m, GARDEN, 'ours@example.com', 'admin');
		const elsewhere = await m.seed.createSeededHousehold(
			m.db,
			'Elsewhere',
			'starter',
		);
		const theirs = await personIn(m, elsewhere, 'theirs@example.com', 'admin');
		actAs({ userId: ours, householdId: GARDEN, role: 'admin' });

		expect(
			(await m.household.removeMember(null, form({ userId: theirs }))).ok,
		).toBe(false);
		expect(
			(
				await m.household.setMemberRole(
					null,
					form({ userId: theirs, role: 'member' }),
				)
			).ok,
		).toBe(false);

		// Their invite cannot be withdrawn from here either.
		actAs({ userId: theirs, householdId: elsewhere, role: 'admin' });
		const theirInvite = await m.household.inviteToHousehold(null, form());
		if (!theirInvite.ok || !theirInvite.url) throw new Error('no link');
		const row = await m.db.select().from(m.schema.invite).all();
		const id = row.at(-1)?.id ?? 0;
		actAs({ userId: ours, householdId: GARDEN, role: 'admin' });
		await m.household.withdrawInvite(null, form({ inviteId: String(id) }));
		expect(
			await m.invites.findOpenInvite(theirInvite.url.split('/join/')[1] ?? ''),
		).not.toBeNull();

		const member = await m.db
			.select()
			.from(m.schema.membership)
			.where(eq(m.schema.membership.userId, theirs))
			.get();
		expect(member).toMatchObject({ householdId: elsewhere, role: 'admin' });
	});
});
