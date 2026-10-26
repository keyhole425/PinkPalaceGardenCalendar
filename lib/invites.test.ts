/**
 * Invites are the only way in, so every way they could leak is tested here:
 * a token used twice, used late, used after being withdrawn, used by the
 * wrong address, or raced for by two people at once.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asHouseholdId } from './db/tenancy';
import { createTempGarden, GARDEN, type TempGarden } from './db/testing';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

let garden: TempGarden;

beforeEach(async () => {
	garden?.cleanup();
	garden = await createTempGarden();
	return () => garden.cleanup();
});

async function modules() {
	vi.resetModules();
	const client = await import('./db/client');
	const seed = await import('@/db/seed/seed');
	const schema = await import('./db/schema');
	const invites = await import('./invites');
	const { auth } = await import('./auth');
	await seed.seedGarden(client.db);
	return { db: client.db, schema, invites, auth, seed };
}

const PASSWORD = 'a long garden password';

function tokenOf(url: string): string {
	return url.split('/join/')[1] ?? '';
}

function person(email: string, extra: { householdName?: string } = {}) {
	return { name: 'Someone', email, password: PASSWORD, ...extra };
}

describe('an invite to join a household', () => {
	it('makes an account in that household, with the role it was made for', async () => {
		const { db, schema, invites } = await modules();
		const minted = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
			role: 'admin',
		});

		const spent = await invites.createAccountFromInvite(
			tokenOf(minted.url),
			person('new@example.com'),
		);
		expect(spent).toMatchObject({ ok: true, householdId: GARDEN });

		const member = await db.select().from(schema.membership).get();
		expect(member).toMatchObject({ householdId: GARDEN, role: 'admin' });
		const credential = await db.select().from(schema.account).get();
		expect(credential?.providerId).toBe('credential');
		expect(credential?.password).not.toContain(PASSWORD);
	});

	it('keeps only a hash of the token', async () => {
		const { db, schema, invites } = await modules();
		const minted = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
		});
		const token = tokenOf(minted.url);

		const row = await db.select().from(schema.invite).get();
		expect(row?.tokenHash).toBe(invites.hashToken(token));
		expect(JSON.stringify(row)).not.toContain(token);
	});

	it('works once', async () => {
		const { invites } = await modules();
		const minted = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
		});
		const token = tokenOf(minted.url);

		expect(
			(await invites.createAccountFromInvite(token, person('a@example.com'))).ok,
		).toBe(true);
		const second = await invites.createAccountFromInvite(
			token,
			person('b@example.com'),
		);
		expect(second).toMatchObject({ ok: false });
	});

	it('does not work once it has run out', async () => {
		const { db, schema, invites } = await modules();
		const minted = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
		});
		await db
			.update(schema.invite)
			.set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
			.run();

		const spent = await invites.createAccountFromInvite(
			tokenOf(minted.url),
			person('late@example.com'),
		);
		expect(spent.ok).toBe(false);
		expect(await db.select().from(schema.user).all()).toHaveLength(0);
	});

	it('does not work once it has been withdrawn', async () => {
		const { invites } = await modules();
		const minted = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
		});
		await invites.revokeInvite(minted.id, GARDEN);

		const spent = await invites.createAccountFromInvite(
			tokenOf(minted.url),
			person('x@example.com'),
		);
		expect(spent.ok).toBe(false);
	});

	it('cannot be withdrawn by another household', async () => {
		const { db, invites, seed } = await modules();
		const minted = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
		});
		const other = await seed.createSeededHousehold(db, 'Elsewhere', 'starter');
		await invites.revokeInvite(minted.id, other);

		expect(await invites.findOpenInvite(tokenOf(minted.url))).not.toBeNull();
	});

	it('is only for the address it was made for, when it names one', async () => {
		const { invites } = await modules();
		const minted = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
			email: 'Meant@Example.com',
		});
		const token = tokenOf(minted.url);

		expect(
			(await invites.createAccountFromInvite(token, person('other@example.com')))
				.ok,
		).toBe(false);
		expect(
			(await invites.createAccountFromInvite(token, person('meant@example.com')))
				.ok,
		).toBe(true);
	});

	it('will not make a second account for one address', async () => {
		const { invites } = await modules();
		const first = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
		});
		const second = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
		});
		await invites.createAccountFromInvite(
			tokenOf(first.url),
			person('same@example.com'),
		);

		const again = await invites.createAccountFromInvite(
			tokenOf(second.url),
			person('same@example.com'),
		);
		expect(again).toMatchObject({ ok: false });
		// And the second invite is still good for somebody else.
		expect(await invites.findOpenInvite(tokenOf(second.url))).not.toBeNull();
	});

	it('lets exactly one of two people racing for it in', async () => {
		const { db, schema, invites } = await modules();
		const minted = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
		});
		const token = tokenOf(minted.url);

		const results = await Promise.all([
			invites.createAccountFromInvite(token, person('one@example.com')),
			invites.createAccountFromInvite(token, person('two@example.com')),
		]);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		expect(await db.select().from(schema.user).all()).toHaveLength(1);
		expect(await db.select().from(schema.membership).all()).toHaveLength(1);
	});

	it('leaves an account that can sign in', async () => {
		const { invites, auth } = await modules();
		const minted = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
		});
		await invites.createAccountFromInvite(
			tokenOf(minted.url),
			person('Signs@Example.com'),
		);

		const signedIn = await auth.api.signInEmail({
			body: { email: 'signs@example.com', password: PASSWORD },
		});
		expect(signedIn.user.email).toBe('signs@example.com');
		await expect(
			auth.api.signInEmail({
				body: { email: 'signs@example.com', password: 'wrong password!' },
			}),
		).rejects.toThrow();
	});
});

describe('an invite to start a garden', () => {
	it('makes a new household with its own starter garden, and an admin to run it', async () => {
		const { db, schema, invites } = await modules();
		const minted = await invites.mintInvite({ kind: 'new_household' });

		const spent = await invites.createAccountFromInvite(
			tokenOf(minted.url),
			person('friend@example.com', { householdName: 'The back yard' }),
		);
		if (!spent.ok) throw new Error(spent.error);
		expect(spent.householdId).not.toBe(GARDEN);

		const home = await db
			.select()
			.from(schema.household)
			.where(eq(schema.household.id, spent.householdId))
			.get();
		expect(home).toMatchObject({ name: 'The back yard', seedProfile: 'starter' });
		const member = await db.select().from(schema.membership).get();
		expect(member).toMatchObject({ householdId: spent.householdId, role: 'admin' });
		const places = await db
			.select()
			.from(schema.environment)
			.where(eq(schema.environment.householdId, spent.householdId))
			.all();
		expect(places.map((p) => p.slug)).toEqual(['bed-1']);
	});

	it('wants the garden named', async () => {
		const { invites } = await modules();
		const minted = await invites.mintInvite({ kind: 'new_household' });
		const spent = await invites.createAccountFromInvite(
			tokenOf(minted.url),
			person('friend@example.com'),
		);
		expect(spent.ok).toBe(false);
		// Asking again with a name still works: the invite was not spent.
		expect(await invites.findOpenInvite(tokenOf(minted.url))).not.toBeNull();
	});
});

describe('a password reset', () => {
	it('changes the password and signs the person out everywhere', async () => {
		const { db, schema, invites, auth } = await modules();
		const join = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
		});
		const made = await invites.createAccountFromInvite(
			tokenOf(join.url),
			person('forgot@example.com'),
		);
		if (!made.ok) throw new Error(made.error);
		await auth.api.signInEmail({
			body: { email: 'forgot@example.com', password: PASSWORD },
		});
		expect(await db.select().from(schema.session).all()).toHaveLength(1);

		const reset = await invites.mintInvite({
			kind: 'reset_password',
			userId: made.userId,
		});
		const result = await invites.resetPasswordFromInvite(
			tokenOf(reset.url),
			'an entirely new password',
		);
		expect(result).toEqual({ ok: true, email: 'forgot@example.com' });
		expect(await db.select().from(schema.session).all()).toHaveLength(0);

		await expect(
			auth.api.signInEmail({
				body: { email: 'forgot@example.com', password: PASSWORD },
			}),
		).rejects.toThrow();
		const again = await auth.api.signInEmail({
			body: { email: 'forgot@example.com', password: 'an entirely new password' },
		});
		expect(again.user.email).toBe('forgot@example.com');
	});

	it('cannot be used to make an account', async () => {
		const { invites } = await modules();
		const join = await invites.mintInvite({
			kind: 'join_household',
			householdId: GARDEN,
		});
		const made = await invites.createAccountFromInvite(
			tokenOf(join.url),
			person('someone@example.com'),
		);
		if (!made.ok) throw new Error(made.error);
		const reset = await invites.mintInvite({
			kind: 'reset_password',
			userId: made.userId,
		});

		const spent = await invites.createAccountFromInvite(
			tokenOf(reset.url),
			person('sneaky@example.com'),
		);
		expect(spent.ok).toBe(false);
	});
});

describe('the database', () => {
	it('refuses an invite that does not say which garden to join', async () => {
		const { db, schema } = await modules();
		await expect(
			db
				.insert(schema.invite)
				.values({
					tokenHash: 'x',
					kind: 'join_household',
					expiresAt: new Date().toISOString(),
				})
				.run(),
		).rejects.toThrow();
		await expect(
			db
				.insert(schema.invite)
				.values({
					tokenHash: 'y',
					kind: 'new_household',
					householdId: asHouseholdId(1),
					expiresAt: new Date().toISOString(),
				})
				.run(),
		).rejects.toThrow();
	});
});
