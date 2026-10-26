'use client';

import { useActionState } from 'react';
import { acceptInvite, choosePassword } from '@/actions/account';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';

const MIN = 12;

/** Making an account from an invite: to join a garden, or to start one. */
export function JoinForm({
	token,
	startsGarden,
	email,
}: {
	token: string;
	startsGarden: boolean;
	/** Fixed when the invite was made for one address. */
	email: string | null;
}) {
	const [state, formAction, pending] = useActionState(acceptInvite, null);

	return (
		<form action={formAction} className="space-y-3">
			<input type="hidden" name="token" value={token} />
			{startsGarden && (
				<Field
					label="Your garden"
					hint="What to call it. You can change this later."
				>
					<input
						name="householdName"
						required
						maxLength={80}
						placeholder="The back yard"
						className={inputClass}
					/>
				</Field>
			)}
			<Field label="Your name" hint="What the rest of the household sees.">
				<input
					name="name"
					required
					maxLength={80}
					autoComplete="name"
					className={inputClass}
				/>
			</Field>
			<Field
				label="Email"
				hint={email ? 'This invite is for this address.' : undefined}
			>
				<input
					name="email"
					type="email"
					required
					autoComplete="email"
					defaultValue={email ?? undefined}
					readOnly={email !== null}
					className={inputClass}
				/>
			</Field>
			<Field
				label="Password"
				hint={`At least ${MIN} characters. A short sentence works well.`}
			>
				<input
					name="password"
					type="password"
					required
					minLength={MIN}
					maxLength={128}
					autoComplete="new-password"
					className={inputClass}
				/>
			</Field>
			<div className="flex flex-wrap items-center gap-3">
				<Button type="submit" pending={pending} pendingLabel="Making your account">
					{startsGarden ? 'Start my garden' : 'Join'}
				</Button>
				{state && !state.ok && (
					<p role="alert" className="text-prune-deep text-sm">
						{state.error}
					</p>
				)}
			</div>
		</form>
	);
}

/** Spending a reset invite on a new password. */
export function ResetForm({ token }: { token: string }) {
	const [state, formAction, pending] = useActionState(choosePassword, null);

	return (
		<form action={formAction} className="space-y-3">
			<input type="hidden" name="token" value={token} />
			<Field label="New password" hint={`At least ${MIN} characters.`}>
				<input
					name="password"
					type="password"
					required
					minLength={MIN}
					maxLength={128}
					autoComplete="new-password"
					className={inputClass}
				/>
			</Field>
			<div className="flex flex-wrap items-center gap-3">
				<Button type="submit" pending={pending} pendingLabel="Saving">
					Save and sign in
				</Button>
				{state && !state.ok && (
					<p role="alert" className="text-prune-deep text-sm">
						{state.error}
					</p>
				)}
			</div>
		</form>
	);
}
