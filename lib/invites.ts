/**
 * Invites: the only way into figgy.
 *
 * A token is 32 random bytes, shown once as a link and stored only as its
 * SHA-256, so a copy of the database cannot be turned into a way in. Each one
 * is good once, for seven days, and can be withdrawn before then.
 *
 * Who may make which kind is decided by the caller - actions/invites.ts and
 * scripts/admin - not here. This file only makes them and spends them.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { createSeededHousehold } from '@/db/seed/seed';
import { auth, baseUrl, MIN_PASSWORD_LENGTH } from '@/lib/auth';
import { db, type Tx } from '@/lib/db/client';
import {
	account,
	type InviteKind,
	invite,
	membership,
	type Role,
	session,
	user,
} from '@/lib/db/schema';
import { asHouseholdId, type HouseholdId } from '@/lib/db/tenancy';

export const INVITE_DAYS = 7;

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export type MintedInvite = {
	id: number;
	/** The whole link. This is the only time it exists anywhere. */
	url: string;
	expiresAt: string;
};

export async function mintInvite(args: {
	kind: InviteKind;
	householdId?: HouseholdId;
	role?: Role;
	userId?: string;
	email?: string;
	createdByUserId?: string;
}): Promise<MintedInvite> {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
	const row = await db
		.insert(invite)
		.values({
			tokenHash: hashToken(token),
			kind: args.kind,
			householdId: args.householdId ?? null,
			role: args.kind === 'new_household' ? 'admin' : (args.role ?? 'member'),
			userId: args.userId ?? null,
			email: args.email?.trim().toLowerCase() || null,
			createdByUserId: args.createdByUserId ?? null,
			expiresAt,
		})
		.returning({ id: invite.id })
		.get();
	return { id: row.id, url: `${baseUrl()}/join/${token}`, expiresAt };
}

/** Still good: not used, not withdrawn, not out of date. */
function usable(now: string) {
	return and(
		isNull(invite.usedAt),
		isNull(invite.revokedAt),
		gt(invite.expiresAt, now),
	);
}

export type OpenInvite = {
	id: number;
	kind: InviteKind;
	email: string | null;
	householdId: number | null;
	userId: string | null;
};

/** The invite behind a link, if it can still be used. */
export async function findOpenInvite(token: string): Promise<OpenInvite | null> {
	const row = await db
		.select({
			id: invite.id,
			kind: invite.kind,
			email: invite.email,
			householdId: invite.householdId,
			userId: invite.userId,
		})
		.from(invite)
		.where(
			and(eq(invite.tokenHash, hashToken(token)), usable(new Date().toISOString())),
		)
		.get();
	return row ?? null;
}

export const signUpSchema = z.object({
	name: z.string().trim().min(1, 'Say what to call you.').max(80),
	email: z
		.string()
		.trim()
		.toLowerCase()
		.pipe(z.email('That does not look like an email address.')),
	password: z
		.string()
		.min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
		.max(128, 'That is longer than figgy keeps.'),
	householdName: z.string().trim().max(80).optional(),
});

export type SignUp = z.infer<typeof signUpSchema>;

export type Spent =
	| { ok: true; userId: string; householdId: HouseholdId; email: string }
	| { ok: false; error: string };

const GONE =
	'That link has already been used, or has run out. Ask whoever sent it for a new one.';

/**
 * Makes an account from an invite, and spends the invite.
 *
 * All of it happens in one transaction, and the first write is the claim -
 * `UPDATE ... WHERE still usable RETURNING` - so two people racing for the
 * same link cannot both get in: one claims it, the other finds it spent.
 * Better Auth's own sign-up is switched off, which is why the user and the
 * credential are written here, in exactly the shape its sign-in reads.
 */
export async function createAccountFromInvite(
	token: string,
	input: SignUp,
): Promise<Spent> {
	// Lower-cased here rather than trusted to the caller: Better Auth looks
	// addresses up lower-cased, so one stored as typed could never sign in.
	const email = input.email.trim().toLowerCase();
	const open = await findOpenInvite(token);
	if (!open || open.kind === 'reset_password') return { ok: false, error: GONE };
	if (open.email && open.email !== email) {
		return { ok: false, error: 'This invite is for a different email address.' };
	}
	if (open.kind === 'new_household' && !input.householdName) {
		return { ok: false, error: 'Give your garden a name.' };
	}

	// Hashing is slow on purpose. Done before the transaction, so the database
	// is not held while it runs.
	const hash = await (await auth.$context).password.hash(input.password);

	try {
		return await db.transaction(async (tx): Promise<Spent> => {
			const taken = await tx
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, email))
				.get();
			if (taken) {
				return {
					ok: false,
					error: 'There is already an account for that address. Sign in instead.',
				};
			}

			const now = new Date().toISOString();
			const claimed = await tx
				.update(invite)
				.set({ usedAt: now })
				.where(and(eq(invite.id, open.id), usable(now)))
				.returning()
				.get();
			if (!claimed) return { ok: false, error: GONE };

			const userId = randomUUID();
			await tx.insert(user).values({ id: userId, name: input.name, email }).run();
			await tx
				.insert(account)
				.values({
					id: randomUUID(),
					userId,
					accountId: userId,
					providerId: 'credential',
					password: hash,
				})
				.run();

			const householdId =
				claimed.kind === 'new_household'
					? await createSeededHousehold(
							tx,
							input.householdName ?? 'My garden',
							'starter',
						)
					: asHouseholdId(claimed.householdId as number);
			await tx
				.insert(membership)
				.values({ userId, householdId, role: claimed.role })
				.run();
			await tx
				.update(invite)
				.set({ usedByUserId: userId })
				.where(eq(invite.id, claimed.id))
				.run();

			return { ok: true, userId, householdId, email };
		});
	} catch (error) {
		// Two sign-ups racing for one address: the unique index catches the
		// second, and the transaction takes the claim back with it.
		if (
			String(error instanceof Error ? (error.cause ?? error) : error).includes(
				'UNIQUE',
			)
		) {
			return {
				ok: false,
				error: 'There is already an account for that address. Sign in instead.',
			};
		}
		throw error;
	}
}

/**
 * Spends a reset invite on a new password, and signs the person out
 * everywhere: whoever had the old one should not still be in.
 */
export async function resetPasswordFromInvite(
	token: string,
	password: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
	const open = await findOpenInvite(token);
	if (open?.kind !== 'reset_password' || !open.userId) {
		return { ok: false, error: GONE };
	}
	const hash = await (await auth.$context).password.hash(password);
	const userId = open.userId;

	return db.transaction(async (tx) => {
		const now = new Date().toISOString();
		const claimed = await tx
			.update(invite)
			.set({ usedAt: now, usedByUserId: userId })
			.where(and(eq(invite.id, open.id), usable(now)))
			.returning({ id: invite.id })
			.get();
		if (!claimed) return { ok: false as const, error: GONE };

		const person = await tx
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, userId))
			.get();
		if (!person) return { ok: false as const, error: GONE };

		await setPassword(tx, userId, hash);
		await tx.delete(session).where(eq(session.userId, userId)).run();
		return { ok: true as const, email: person.email };
	});
}

async function setPassword(tx: Tx, userId: string, hash: string) {
	const existing = await tx
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
		.get();
	if (existing) {
		await tx
			.update(account)
			.set({ password: hash })
			.where(eq(account.id, existing.id))
			.run();
	} else {
		await tx
			.insert(account)
			.values({
				id: randomUUID(),
				userId,
				accountId: userId,
				providerId: 'credential',
				password: hash,
			})
			.run();
	}
}

/** Withdraws an invite. Only one that has not been used yet. */
export async function revokeInvite(id: number, householdId: HouseholdId | null) {
	await db
		.update(invite)
		.set({ revokedAt: new Date().toISOString() })
		.where(
			and(
				eq(invite.id, id),
				isNull(invite.usedAt),
				householdId === null
					? eq(invite.kind, 'new_household')
					: eq(invite.householdId, householdId),
			),
		)
		.run();
}

export type PendingInvite = {
	id: number;
	kind: InviteKind;
	role: Role;
	email: string | null;
	expiresAt: string;
	createdAt: string;
};

/**
 * Invites still waiting to be used: a household's own, or (with null) the
 * new-garden invites a site admin has out.
 */
export async function listPendingInvites(
	householdId: HouseholdId | null,
): Promise<PendingInvite[]> {
	return db
		.select({
			id: invite.id,
			kind: invite.kind,
			role: invite.role,
			email: invite.email,
			expiresAt: invite.expiresAt,
			createdAt: invite.createdAt,
		})
		.from(invite)
		.where(
			and(
				usable(new Date().toISOString()),
				householdId === null
					? eq(invite.kind, 'new_household')
					: and(
							eq(invite.kind, 'join_household'),
							eq(invite.householdId, householdId),
						),
			),
		)
		.orderBy(desc(invite.id))
		.all();
}
