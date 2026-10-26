/** Who is in a household. */
import { asc, eq } from 'drizzle-orm';
import { db } from '../client';
import { household, membership, type Role, user } from '../schema';
import type { HouseholdId } from '../tenancy';

export type Member = { userId: string; name: string; email: string; role: Role };

export async function listMembers(hid: HouseholdId): Promise<Member[]> {
	return db
		.select({
			userId: user.id,
			name: user.name,
			email: user.email,
			role: membership.role,
		})
		.from(membership)
		.innerJoin(user, eq(membership.userId, user.id))
		.where(eq(membership.householdId, hid))
		.orderBy(asc(user.name))
		.all();
}

export async function getHousehold(hid: HouseholdId) {
	return db.select().from(household).where(eq(household.id, hid)).get();
}
