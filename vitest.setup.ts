/**
 * Runs before any test module is imported.
 *
 * Without this, a test file that imports anything touching the database - even
 * indirectly, through a module that imports the client - opens the real
 * garden.db at load time, before any test has had the chance to point it
 * somewhere safe. That is not a hypothetical: it happened, and it wrote test
 * plants into the actual garden.
 *
 * Pointing TURSO_DATABASE_URL at a temp file here means the real database is
 * unreachable from the test run, whatever a test file imports. The auth token
 * goes too, and lib/db/client.ts refuses anything but a local file under
 * vitest, so a hosted database is out of reach as well.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, vi } from 'vitest';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figgy-vitest-'));
process.env.TURSO_DATABASE_URL = `file:${path.join(dir, 'default.db')}`;
delete process.env.TURSO_AUTH_TOKEN;

/*
 * Nobody is signed in under vitest - there is no request, so no cookie - so
 * the context module answers from lib/auth/testing instead. Each test picks
 * who it is with actAs(); the default is an admin of household 1, which is
 * the household seedGarden() makes in an empty database.
 */
vi.mock('@/lib/auth/context', async () => {
	const { acting } = await import('@/lib/auth/testing');
	const { asHouseholdId } = await import('@/lib/db/tenancy');
	const { redirect } = await import('next/navigation');
	return {
		getSession: async () => {
			const who = acting();
			return who.signedIn
				? { user: { id: who.userId, name: who.userName }, session: {} }
				: null;
		},
		requireHousehold: async () => {
			const who = acting();
			if (!who.signedIn) redirect('/login');
			return {
				userId: who.userId,
				userName: who.userName,
				householdId: asHouseholdId(who.householdId),
				householdName: who.householdName,
				role: who.role,
			};
		},
		isSiteAdmin: async () => acting().siteAdmin,
	};
});

beforeEach(async () => {
	const { actAs } = await import('@/lib/auth/testing');
	actAs();
});
