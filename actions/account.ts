'use server';

/**
 * Getting in and getting out.
 *
 * Signing in is not here: the login form talks to Better Auth's own endpoint
 * over HTTP, because that is where the rate limit is applied. A server action
 * calling auth.api directly would skip it.
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth, MIN_PASSWORD_LENGTH } from '@/lib/auth';
import {
	createAccountFromInvite,
	resetPasswordFromInvite,
	signUpSchema,
} from '@/lib/invites';

export type AccountResult = { ok: false; error: string } | null;

/** Signs in straight after the account is made, so a new person lands in their garden. */
async function signIn(email: string, password: string) {
	await auth.api.signInEmail({
		body: { email, password },
		headers: await headers(),
	});
}

export async function acceptInvite(
	_previous: AccountResult,
	form: FormData,
): Promise<AccountResult> {
	const token = form.get('token')?.toString() ?? '';
	const parsed = signUpSchema.safeParse({
		name: form.get('name'),
		email: form.get('email'),
		password: form.get('password'),
		householdName: form.get('householdName') || undefined,
	});
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? 'Check the form.',
		};
	}

	const spent = await createAccountFromInvite(token, parsed.data);
	if (!spent.ok) return spent;

	await signIn(spent.email, parsed.data.password);
	redirect('/now');
}

const passwordSchema = z
	.string()
	.min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
	.max(128, 'That is longer than figgy keeps.');

export async function choosePassword(
	_previous: AccountResult,
	form: FormData,
): Promise<AccountResult> {
	const token = form.get('token')?.toString() ?? '';
	const parsed = passwordSchema.safeParse(form.get('password'));
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? 'Check the password.',
		};
	}

	const reset = await resetPasswordFromInvite(token, parsed.data);
	if (!reset.ok) return reset;

	await signIn(reset.email, parsed.data);
	redirect('/now');
}

export async function signOut(): Promise<void> {
	await auth.api.signOut({ headers: await headers() });
	redirect('/login');
}
