/**
 * Who is asking, and which garden they are asking about.
 *
 * Every page and every server action starts here. The household comes from
 * the signed-in person and nothing else: a household id in a form, a URL or a
 * cookie is never trusted, which is what keeps one garden out of another.
 *
 * The session may come from Better Auth's short-lived cookie cache, but
 * membership and the site-admin flag are read from the database every time.
 * Removing someone, demoting them or revoking site admin therefore takes
 * effect on their very next request, not whenever a cookie happens to expire.
 */
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { household, membership, type Role, user } from '@/lib/db/schema';
import { asHouseholdId, type HouseholdId } from '@/lib/db/tenancy';

export type { Role };

export type HouseholdContext = {
	userId: string;
	userName: string;
	householdId: HouseholdId;
	householdName: string;
	role: Role;
};

/** The signed-in session, or null. Once per request. */
export const getSession = cache(async () =>
	auth.api.getSession({ headers: await headers() }),
);

/**
 * The household for this request, or a redirect: to sign in if nobody is,
 * or to /no-garden if they belong to none (removed, say).
 */
export const requireHousehold = cache(async (): Promise<HouseholdContext> => {
	const signedIn = await getSession();
	if (!signedIn) redirect('/login');

	const row = await db
		.select({
			householdId: membership.householdId,
			role: membership.role,
			householdName: household.name,
		})
		.from(membership)
		.innerJoin(household, eq(membership.householdId, household.id))
		.where(eq(membership.userId, signedIn.user.id))
		.get();
	if (!row) redirect('/no-garden');

	return {
		userId: signedIn.user.id,
		userName: signedIn.user.name,
		householdId: asHouseholdId(row.householdId),
		householdName: row.householdName,
		role: row.role,
	};
});

/** Whether this person may start new gardens. Always from the database. */
export async function isSiteAdmin(userId: string): Promise<boolean> {
	const row = await db
		.select({ siteAdmin: user.siteAdmin })
		.from(user)
		.where(eq(user.id, userId))
		.get();
	return row?.siteAdmin === true;
}
