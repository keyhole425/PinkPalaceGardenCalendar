/**
 * Who is asking, and which garden they are asking about.
 *
 * Every page and every server action starts here. The household comes from
 * the signed-in person and nothing else: a household id in a form, a URL or a
 * cookie is never trusted, which is what keeps one garden out of another.
 *
 * Until accounts exist there is one garden, and this answers with it.
 */
import { asc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from '@/lib/db/client';
import { household } from '@/lib/db/schema';
import { asHouseholdId, type HouseholdId } from '@/lib/db/tenancy';

export type Role = 'admin' | 'member';

export type HouseholdContext = {
	userId: string | null;
	householdId: HouseholdId;
	householdName: string;
	role: Role;
};

/**
 * The household for this request. Cached per request: a page and the
 * components under it can all ask without each going to the database.
 */
export const requireHousehold = cache(async (): Promise<HouseholdContext> => {
	const row = await db
		.select({ id: household.id, name: household.name })
		.from(household)
		.orderBy(asc(household.id))
		.limit(1)
		.get();
	if (!row) redirect('/no-garden');
	return {
		userId: null,
		householdId: asHouseholdId(row.id),
		householdName: row.name,
		role: 'admin',
	};
});
