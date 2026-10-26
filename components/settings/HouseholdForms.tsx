'use client';

import { useActionState, useState } from 'react';
import { signOut } from '@/actions/account';
import {
	type HouseholdResult,
	inviteNewGarden,
	inviteToHousehold,
	removeMember,
	renameHousehold,
	setMemberRole,
	withdrawInvite,
} from '@/actions/household';
import { restartTours } from '@/actions/tour';
import { Button } from '@/components/ui/Button';
import { Field, inputClass, selectClass } from '@/components/ui/Field';

function Problem({ state }: { state: HouseholdResult | null }) {
	return state && !state.ok ? (
		<p role="alert" className="text-prune-deep text-sm">
			{state.error}
		</p>
	) : null;
}

export function RenameHousehold({ name }: { name: string }) {
	const [state, formAction, pending] = useActionState(renameHousehold, null);
	return (
		<form action={formAction} className="flex flex-wrap items-end gap-3">
			<Field label="Name" className="min-w-0 flex-1">
				<input
					name="name"
					defaultValue={name}
					required
					maxLength={80}
					className={inputClass}
				/>
			</Field>
			<Button type="submit" pending={pending} pendingLabel="Saving">
				Rename
			</Button>
			{state?.ok && <span className="text-fertilise-deep text-sm">Saved.</span>}
			<Problem state={state} />
		</form>
	);
}

/**
 * The link, once. It is not stored anywhere figgy can show it again, so the
 * page says so and offers to copy it.
 */
function FreshLink({ url, expiresAt }: { url: string; expiresAt?: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="space-y-2 rounded-md border border-palace-300 bg-palace-50 p-3">
			<Field label="Send them this link">
				<input
					readOnly
					value={url}
					className={inputClass}
					onFocus={(e) => e.target.select()}
				/>
			</Field>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					onClick={async () => {
						await navigator.clipboard.writeText(url);
						setCopied(true);
					}}
				>
					{copied ? 'Copied' : 'Copy link'}
				</Button>
				<span className="text-ink-soft text-xs">
					Works once
					{expiresAt
						? `, until ${new Date(expiresAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}`
						: ''}
					. figgy will not show it again.
				</span>
			</div>
		</div>
	);
}

export function InviteForm({ kind }: { kind: 'household' | 'garden' }) {
	const [state, formAction, pending] = useActionState(
		kind === 'household' ? inviteToHousehold : inviteNewGarden,
		null,
	);
	return (
		<div className="space-y-3">
			<form action={formAction} className="space-y-3">
				<Field
					label="Their email"
					hint="Optional. If given, only that address can use the link."
				>
					<input name="email" type="email" className={inputClass} />
				</Field>
				<div className="flex flex-wrap items-end gap-3">
					{kind === 'household' && (
						<Field label="As">
							<select name="role" defaultValue="member" className={selectClass}>
								<option value="member">a member</option>
								<option value="admin">an admin</option>
							</select>
						</Field>
					)}
					<Button type="submit" pending={pending} pendingLabel="Making it">
						Make an invite link
					</Button>
				</div>
			</form>
			<Problem state={state} />
			{state?.ok && state.url && (
				<FreshLink url={state.url} expiresAt={state.expiresAt} />
			)}
		</div>
	);
}

export function WithdrawInvite({ id }: { id: number }) {
	const [state, formAction, pending] = useActionState(withdrawInvite, null);
	return (
		<form action={formAction} className="inline">
			<input type="hidden" name="inviteId" value={id} />
			<Button type="submit" variant="danger" size="sm" pending={pending}>
				Withdraw
			</Button>
			<Problem state={state} />
		</form>
	);
}

export function MemberControls({
	userId,
	name,
	role,
}: {
	userId: string;
	name: string;
	role: 'admin' | 'member';
}) {
	const [roleState, roleAction, rolePending] = useActionState(setMemberRole, null);
	const [removeState, removeAction, removePending] = useActionState(
		removeMember,
		null,
	);
	return (
		<span className="inline-flex flex-wrap items-baseline gap-3">
			<form action={roleAction} className="inline">
				<input type="hidden" name="userId" value={userId} />
				<input
					type="hidden"
					name="role"
					value={role === 'admin' ? 'member' : 'admin'}
				/>
				<Button type="submit" variant="quiet" size="sm" pending={rolePending}>
					{role === 'admin' ? 'Make a member' : 'Make an admin'}
				</Button>
			</form>
			<details className="inline">
				<summary className="cursor-pointer text-ink-soft text-xs underline hover:text-prune-deep">
					Remove
				</summary>
				<form action={removeAction} className="mt-1">
					<input type="hidden" name="userId" value={userId} />
					<Button type="submit" variant="danger" size="sm" pending={removePending}>
						Remove {name} and their account
					</Button>
				</form>
			</details>
			<Problem state={roleState} />
			<Problem state={removeState} />
		</span>
	);
}

export function SignOutButton() {
	return (
		<form action={signOut}>
			<Button type="submit" variant="quiet">
				Sign out
			</Button>
		</form>
	);
}

/** Clears where you got to, so the welcome offer appears again. */
export function TakeTheTourAgain() {
	return (
		<form
			action={async () => {
				try {
					sessionStorage.removeItem('figgy.tour.snoozed');
				} catch {
					// Nothing stored, or nowhere to store it.
				}
				await restartTours();
			}}
		>
			<Button type="submit" variant="quiet">
				Take the tour again
			</Button>
		</form>
	);
}
