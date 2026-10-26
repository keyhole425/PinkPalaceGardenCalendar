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
			setError(
				failed.status === 429
					? 'Too many tries. Wait a minute, then try again.'
					: 'That email and password do not match.',
			);
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
