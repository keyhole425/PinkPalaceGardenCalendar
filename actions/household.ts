'use server';

/**
 * Running a household: its name, who is in it, and inviting people.
 *
 * Every action here is for a household admin, and works on the admin's own
 * household only - the id is always the signed-in person's, never one sent
 * in the form. Starting a new garden is the one thing a site admin does on
 * top, and that is checked against the database, not a cookie.
 */
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
	type HouseholdContext,
	isSiteAdmin,
	requireHousehold,
} from '@/lib/auth/context';
import { db, type Tx } from '@/lib/db/client';
import {
	account,
	aiCall,
	household,
	invite,
	membership,
	ROLES,
	session,
	user,
} from '@/lib/db/schema';
import { mintInvite, revokeInvite } from '@/lib/invites';

export type HouseholdResult =
	| { ok: true; url?: string; expiresAt?: string }
	| { ok: false; error: string };

const NOT_ADMIN: HouseholdResult = {
	ok: false,
	error: 'Only an admin of this household can do that.',
};

function refresh() {
	revalidatePath('/settings');
}

async function requireAdmin(): Promise<HouseholdContext | null> {
	const ctx = await requireHousehold();
	return ctx.role === 'admin' ? ctx : null;
}

const nameSchema = z.string().trim().min(1, 'Give it a name.').max(80);

export async function renameHousehold(
	_previous: HouseholdResult | null,
	form: FormData,
): Promise<HouseholdResult> {
	const ctx = await requireAdmin();
	if (!ctx) return NOT_ADMIN;
	const name = nameSchema.safeParse(form.get('name'));
	if (!name.success)
		return { ok: false, error: name.error.issues[0]?.message ?? '' };

	await db
		.update(household)
		.set({ name: name.data })
		.where(eq(household.id, ctx.householdId))
		.run();
	revalidatePath('/', 'layout');
	return { ok: true };
}

const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email('That does not look like an email address.'))
	.optional();

export async function inviteToHousehold(
	_previous: HouseholdResult | null,
	form: FormData,
): Promise<HouseholdResult> {
	const ctx = await requireAdmin();
	if (!ctx) return NOT_ADMIN;
	const parsed = z
		.object({ email: emailSchema, role: z.enum(ROLES).default('member') })
		.safeParse({
			email: form.get('email') || undefined,
			role: form.get('role') || undefined,
		});
	if (!parsed.success)
		return { ok: false, error: parsed.error.issues[0]?.message ?? '' };

	const minted = await mintInvite({
		kind: 'join_household',
		householdId: ctx.householdId,
		role: parsed.data.role,
		email: parsed.data.email,
		createdByUserId: ctx.userId,
	});
	refresh();
	return { ok: true, url: minted.url, expiresAt: minted.expiresAt };
}

export async function withdrawInvite(
	_previous: HouseholdResult | null,
	form: FormData,
): Promise<HouseholdResult> {
	const ctx = await requireHousehold();
	const id = Number(form.get('inviteId'));
	if (!Number.isInteger(id) || id <= 0)
		return { ok: false, error: 'No such invite.' };

	const row = await db
		.select({ kind: invite.kind, householdId: invite.householdId })
		.from(invite)
		.where(eq(invite.id, id))
		.get();
	if (row?.kind === 'new_household') {
		if (!(await isSiteAdmin(ctx.userId))) return NOT_ADMIN;
		await revokeInvite(id, null);
	} else {
		if (ctx.role !== 'admin') return NOT_ADMIN;
		// Scoped to this household inside revokeInvite: another household's
		// invite id matches nothing.
		await revokeInvite(id, ctx.householdId);
	}
	refresh();
	return { ok: true };
}

/** Someone in this household, by user id - or null if they are not in it. */
async function memberOf(ctx: HouseholdContext, userId: string) {
	return db
		.select({ userId: membership.userId, role: membership.role })
		.from(membership)
		.where(
			and(
				eq(membership.userId, userId),
				eq(membership.householdId, ctx.householdId),
			),
		)
		.get();
}

async function adminCount(ctx: HouseholdContext): Promise<number> {
	return (
		await db
			.select({ userId: membership.userId })
			.from(membership)
			.where(
				and(
					eq(membership.householdId, ctx.householdId),
					eq(membership.role, 'admin'),
				),
			)
			.all()
	).length;
}

export async function setMemberRole(
	_previous: HouseholdResult | null,
	form: FormData,
): Promise<HouseholdResult> {
	const ctx = await requireAdmin();
	if (!ctx) return NOT_ADMIN;
	const parsed = z
		.object({ userId: z.string().min(1), role: z.enum(ROLES) })
		.safeParse({ userId: form.get('userId'), role: form.get('role') });
	if (!parsed.success) return { ok: false, error: 'Nothing to change.' };

	const target = await memberOf(ctx, parsed.data.userId);
	if (!target) return { ok: false, error: 'They are not in this household.' };
	if (
		target.role === 'admin' &&
		parsed.data.role !== 'admin' &&
		(await adminCount(ctx)) <= 1
	) {
		return { ok: false, error: 'A household needs at least one admin.' };
	}

	await db
		.update(membership)
		.set({ role: parsed.data.role })
		.where(eq(membership.userId, target.userId))
		.run();
	refresh();
	return { ok: true };
}

/**
 * Deletes a person outright. They only ever existed for this garden, so
 * there is nothing of theirs worth keeping, and removing the account lets
 * them be invited back later with the same address. Done row by row rather
 * than trusting a cascade, which a hosted connection may not run.
 */
async function deletePerson(tx: Tx, userId: string) {
	await tx
		.update(aiCall)
		.set({ userId: null })
		.where(eq(aiCall.userId, userId))
		.run();
	await tx
		.update(invite)
		.set({ createdByUserId: null })
		.where(eq(invite.createdByUserId, userId))
		.run();
	await tx
		.update(invite)
		.set({ usedByUserId: null })
		.where(eq(invite.usedByUserId, userId))
		.run();
	await tx.delete(invite).where(eq(invite.userId, userId)).run();
	await tx.delete(session).where(eq(session.userId, userId)).run();
	await tx.delete(account).where(eq(account.userId, userId)).run();
	await tx.delete(membership).where(eq(membership.userId, userId)).run();
	await tx.delete(user).where(eq(user.id, userId)).run();
}

export async function removeMember(
	_previous: HouseholdResult | null,
	form: FormData,
): Promise<HouseholdResult> {
	const ctx = await requireAdmin();
	if (!ctx) return NOT_ADMIN;
	const userId = form.get('userId')?.toString() ?? '';

	const target = await memberOf(ctx, userId);
	if (!target) return { ok: false, error: 'They are not in this household.' };
	if (target.userId === ctx.userId) {
		return { ok: false, error: 'You cannot remove yourself.' };
	}
	if (target.role === 'admin' && (await adminCount(ctx)) <= 1) {
		return { ok: false, error: 'A household needs at least one admin.' };
	}

	await db.transaction((tx) => deletePerson(tx, target.userId));
	refresh();
	return { ok: true };
}

export async function inviteNewGarden(
	_previous: HouseholdResult | null,
	form: FormData,
): Promise<HouseholdResult> {
	const ctx = await requireHousehold();
	if (!(await isSiteAdmin(ctx.userId))) {
		return { ok: false, error: 'Only a site admin can start a new garden.' };
	}
	const email = emailSchema.safeParse(form.get('email') || undefined);
	if (!email.success)
		return { ok: false, error: email.error.issues[0]?.message ?? '' };

	const minted = await mintInvite({
		kind: 'new_household',
		email: email.data,
		createdByUserId: ctx.userId,
	});
	refresh();
	return { ok: true, url: minted.url, expiresAt: minted.expiresAt };
}
