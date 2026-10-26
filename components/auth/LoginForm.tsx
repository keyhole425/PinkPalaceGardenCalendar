'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';
import { authClient } from '@/lib/auth/client';

/**
 * Only a path on this site, never somewhere else: `next` arrives in the URL,
 * and a sign-in page that forwards to any address is a phishing tool.
 */
function safeNext(next: string | undefined): string {
	return next?.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
		? next
		: '/now';
}

/**
 * Only a 401 means the password was wrong. A 403 is Better Auth refusing the
 * address the page was opened on (it is not BETTER_AUTH_URL), before any
 * password is looked at - calling that a mismatch sends someone off to reset
 * a password that was right all along.
 */
function problem(status: number): string {
	if (status === 401) return 'That email and password do not match.';
	if (status === 429) return 'Too many tries. Wait a minute, then try again.';
	if (status === 403) {
		return 'figgy won’t sign you in from this address, so your password wasn’t checked. Open figgy from its usual address and try again.';
	}
	return 'That didn’t work - figgy couldn’t check your password just now. Try again in a moment.';
}

/**
 * Posts to Better Auth's endpoint rather than through a server action,
 * because the endpoint is where five wrong passwords in a minute get stopped.
 */
export function LoginForm({ next }: { next?: string }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function submit(form: FormData) {
		setPending(true);
		setError(null);
		const { error: failed } = await authClient.signIn.email({
			email: String(form.get('email') ?? '').trim(),
			password: String(form.get('password') ?? ''),
		});
		setPending(false);
		if (failed) {
			setError(problem(failed.status));
			return;
		}
		router.replace(safeNext(next));
		router.refresh();
	}

	return (
		<form action={submit} className="space-y-3">
			<Field label="Email">
				<input
					name="email"
					type="email"
					autoComplete="email"
					required
					className={inputClass}
				/>
			</Field>
			<Field label="Password">
				<input
					name="password"
					type="password"
					autoComplete="current-password"
					required
					className={inputClass}
				/>
			</Field>
			<div className="flex flex-wrap items-center gap-3">
				<Button type="submit" pending={pending} pendingLabel="Signing in">
					Sign in
				</Button>
				{error && (
					<p role="alert" className="text-prune-deep text-sm">
						{error}
					</p>
				)}
			</div>
		</form>
	);
}
