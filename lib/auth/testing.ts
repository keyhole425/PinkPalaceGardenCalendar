/**
 * Who the tests are signed in as.
 *
 * vitest.setup.ts replaces lib/auth/context with a version that answers from
 * here, so action tests run as a chosen person in a chosen household without
 * a browser or a cookie. Tests of the real context import it with
 * vi.importActual.
 */
import type { Role } from '@/lib/db/schema';

export type Acting = {
	userId: string;
	userName: string;
	householdId: number;
	householdName: string;
	role: Role;
	siteAdmin: boolean;
	/** False to act as nobody: requireHousehold then redirects to /login. */
	signedIn: boolean;
};

const DEFAULT: Acting = {
	userId: 'test-user',
	userName: 'Tester',
	householdId: 1,
	householdName: 'Pink Palace',
	role: 'admin',
	siteAdmin: false,
	signedIn: true,
};

const holder = globalThis as unknown as { figgyActing?: Acting };

export function acting(): Acting {
	holder.figgyActing ??= { ...DEFAULT };
	return holder.figgyActing;
}

/** Act as someone else from here on. Unset fields go back to the default. */
export function actAs(who: Partial<Acting> = {}) {
	holder.figgyActing = { ...DEFAULT, ...who };
}
