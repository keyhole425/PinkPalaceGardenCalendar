/**
 * Keeping one household's garden out of another's.
 *
 * A household id is a branded number. The only places that mint one are
 * requireHousehold() (from the signed-in person), household creation and the
 * seed - never a form field. Every query takes one, so passing a number that
 * arrived in a request where a household is expected is a type error rather
 * than a leak.
 */
import { and, eq, type SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db, type Tx } from './client';

declare const brand: unique symbol;
export type HouseholdId = number & { readonly [brand]: 'HouseholdId' };

/** For the few places allowed to make one: see the comment above. */
export function asHouseholdId(id: number): HouseholdId {
	return id as HouseholdId;
}

type Owned = SQLiteTable & { id: SQLiteColumn; householdId: SQLiteColumn };

/** The filter every query on a household's table carries. */
export function owns(table: Owned, hid: HouseholdId): SQL {
	return eq(table.householdId, hid);
}

/** `id = ? AND household_id = ?` - one row, and only if it is yours. */
export function ownedRow(table: Owned, id: number, hid: HouseholdId): SQL {
	return and(eq(table.id, id), eq(table.householdId, hid)) as SQL;
}

/**
 * Whether an id that arrived from a form belongs to this household.
 *
 * Actions check every id they are handed before writing anything that points
 * at it. The database's triggers would refuse a cross-household reference
 * anyway; this turns that into a polite "no such plant" instead of an error.
 */
export async function isOwned(
	table: Owned,
	id: number,
	hid: HouseholdId,
	exec: typeof db | Tx = db,
): Promise<boolean> {
	const row = await exec
		.select({ id: table.id })
		.from(table)
		.where(ownedRow(table, id, hid))
		.get();
	return row !== undefined;
}
