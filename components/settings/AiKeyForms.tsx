'use client';

import { useActionState } from 'react';
import {
	checkAiKey,
	type KeyResult,
	removeAiKey,
	saveAiKey,
} from '@/actions/ai-key';
import { Button } from '@/components/ui/Button';
import { Field, inputClass } from '@/components/ui/Field';

function Said({ state }: { state: KeyResult | null }) {
	if (!state) return null;
	return state.ok ? (
		<p className="text-fertilise-deep text-sm">{state.message}</p>
	) : (
		<p role="alert" className="text-prune-deep text-sm">
			{state.error}
		</p>
	);
}

/** Adding a key, or replacing the one there is. */
export function SaveKey({ replacing }: { replacing: boolean }) {
	const [state, formAction, pending] = useActionState(saveAiKey, null);
	return (
		<form action={formAction} className="space-y-3">
			<Field
				label={replacing ? 'A new key' : 'Your Anthropic API key'}
				hint="From console.anthropic.com, under API keys. It is checked before it is saved, and figgy never shows it again."
			>
				<input
					name="apiKey"
					type="password"
					required
					autoComplete="off"
					spellCheck={false}
					placeholder="sk-ant-…"
					className={inputClass}
				/>
			</Field>
			<Field
				label="Workspace ID"
				hint="Only for an organisation-level key, which has to say which workspace to bill."
			>
				<input
					name="workspaceId"
					autoComplete="off"
					spellCheck={false}
					className={inputClass}
				/>
			</Field>
			<Button type="submit" pending={pending} pendingLabel="Checking it">
				{replacing ? 'Replace the key' : 'Save the key'}
			</Button>
			<Said state={state} />
		</form>
	);
}

export function CheckKey() {
	const [state, formAction, pending] = useActionState(checkAiKey, null);
	return (
		<form action={formAction} className="space-y-1">
			<Button
				type="submit"
				variant="quiet"
				pending={pending}
				pendingLabel="Checking"
			>
				Check it still works
			</Button>
			<Said state={state} />
		</form>
	);
}

export function RemoveKey() {
	const [state, formAction, pending] = useActionState(removeAiKey, null);
	return (
		<details>
			<summary className="cursor-pointer text-ink-soft text-sm underline hover:text-prune-deep">
				Remove the key
			</summary>
			<form action={formAction} className="mt-2 space-y-1">
				<p className="text-ink-soft text-sm">
					Looking things up, asking and reading sentences switch off for the whole
					household. Everything else keeps working.
				</p>
				<Button type="submit" variant="danger" pending={pending}>
					Remove it
				</Button>
				<Said state={state} />
			</form>
		</details>
	);
}
