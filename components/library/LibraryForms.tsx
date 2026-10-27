'use client';

import { useActionState, useState } from 'react';
import {
	acceptSuggestion,
	type LibraryResult,
	rejectSuggestion,
	saveArticle,
	setShareGrowing,
	suggestSomething,
} from '@/actions/library';
import { Button } from '@/components/ui/Button';
import { Field, selectClass, textareaClass } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';

/** What happened, beside the button that did it. */
function Outcome({ state }: { state: LibraryResult | null }) {
	if (!state) return null;
	return state.ok ? (
		state.message ? (
			<p className="flex items-center gap-1.5 text-fertilise-deep text-sm">
				<Icon name="check" className="h-4 w-4" />
				{state.message}
			</p>
		) : null
	) : (
		<p role="alert" className="text-prune-deep text-sm">
			{state.error}
		</p>
	);
}

/** Accept or turn down one suggestion. A note is marked read rather than accepted. */
export function DecideSuggestion({
	id,
	acceptLabel = 'Accept',
}: {
	id: number;
	acceptLabel?: string;
}) {
	const [accepted, accept, accepting] = useActionState(acceptSuggestion, null);
	const [rejected, reject, rejecting] = useActionState(rejectSuggestion, null);
	const done = accepted?.ok || rejected?.ok;
	return (
		<div className="space-y-1">
			{!done && (
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
					<form action={accept}>
						<input type="hidden" name="id" value={id} />
						<Button type="submit" pending={accepting} pendingLabel="Accepting">
							{acceptLabel}
						</Button>
					</form>
					<form action={reject}>
						<input type="hidden" name="id" value={id} />
						<Button
							type="submit"
							variant="danger"
							pending={rejecting}
							pendingLabel="Turning down"
						>
							Turn down
						</Button>
					</form>
				</div>
			)}
			<Outcome state={accepted ?? rejected} />
		</div>
	);
}

/**
 * A garden's own plant, into the library: as a plant of its own, as a kind
 * of one the library has, or filed with one it already has.
 */
export function PlaceNewPlant({
	id,
	plants,
}: {
	id: number;
	/** Plants that can take it: as a kind, the top-level ones only. */
	plants: { id: number; name: string; canHaveKinds: boolean }[];
}) {
	const [state, formAction, pending] = useActionState(acceptSuggestion, null);
	const [rejected, reject, rejecting] = useActionState(rejectSuggestion, null);
	const [as, setAs] = useState<'new' | 'kind' | 'same'>('new');
	const choices = as === 'kind' ? plants.filter((p) => p.canHaveKinds) : plants;
	if (state?.ok || rejected?.ok) return <Outcome state={state ?? rejected} />;
	return (
		<div className="space-y-2">
			<form action={formAction} className="flex flex-wrap items-end gap-3">
				<input type="hidden" name="id" value={id} />
				<Field label="Add it as" className="min-w-40">
					<select
						name="as"
						value={as}
						onChange={(e) => setAs(e.target.value as typeof as)}
						className={selectClass}
					>
						<option value="new">a plant of its own</option>
						<option value="kind">a kind of…</option>
						<option value="same">the same as…</option>
					</select>
				</Field>
				{as !== 'new' && (
					<Field label="Which plant" className="min-w-40">
						<select name="target" className={selectClass}>
							{choices.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</select>
					</Field>
				)}
				<Button type="submit" pending={pending} pendingLabel="Adding">
					Accept
				</Button>
			</form>
			<form action={reject}>
				<input type="hidden" name="id" value={id} />
				<Button
					type="submit"
					variant="danger"
					size="sm"
					pending={rejecting}
					pendingLabel="Turning down"
				>
					Turn down
				</Button>
			</form>
			<Outcome state={state ?? rejected} />
		</div>
	);
}

export type ArticleFields = {
	id: number;
	summary: string | null;
	regionNote: string | null;
	growingMd: string | null;
	careMd: string | null;
	harvestMd: string | null;
	problemsMd: string | null;
	findingsMd: string | null;
};

const SECTIONS: [keyof Omit<ArticleFields, 'id'>, string, string][] = [
	['summary', 'Opening paragraph', 'Wants warm soil and a long, hot season.'],
	['regionNote', 'In this region', 'Happy here once the nights stay above 12°.'],
	[
		'findingsMd',
		'What gardens found here',
		'Sown in October, most were picking within ten weeks.',
	],
	['growingMd', 'Growing it', 'Sow 5 mm deep in seed-raising mix, on a heat mat.'],
	['careMd', 'Looking after it', 'Water deeply twice a week once flowering.'],
	['harvestMd', 'Picking', 'Pick when fully coloured; cut, don’t pull.'],
	['problemsMd', 'Trouble', 'Fruit fly from February: net or bait.'],
];

/** Every word of an article, as a site admin edits it. Saving publishes it. */
export function ArticleEditor({
	article,
	city,
}: {
	article: ArticleFields;
	city: string;
}) {
	const [state, formAction, pending] = useActionState(saveArticle, null);
	return (
		<form action={formAction} className="space-y-3">
			<input type="hidden" name="id" value={article.id} />
			{SECTIONS.map(([name, label, example]) => (
				<Field
					key={name}
					label={name === 'regionNote' ? `In ${city}` : label}
					hint={
						name === 'findingsMd'
							? 'From the grows above, in your words. Never a garden’s own notes.'
							: undefined
					}
				>
					<textarea
						name={name}
						rows={name === 'summary' ? 3 : 2}
						defaultValue={article[name] ?? ''}
						placeholder={example}
						className={textareaClass}
					/>
				</Field>
			))}
			<div className="flex flex-wrap items-center gap-3">
				<Button type="submit" pending={pending} pendingLabel="Saving">
					Save and publish
				</Button>
				<Outcome state={state} />
			</div>
		</form>
	);
}

/** Settings: whether this garden helps the library. A second press to stop. */
export function ShareSwitch({ sharing }: { sharing: boolean }) {
	const [state, formAction, pending] = useActionState(setShareGrowing, null);
	const [sure, setSure] = useState(false);
	if (!sharing) {
		return (
			<form action={formAction} className="space-y-1">
				<input type="hidden" name="share" value="on" />
				<Button type="submit" pending={pending} pendingLabel="Saving">
					Share again
				</Button>
				<Outcome state={state} />
			</form>
		);
	}
	return (
		<form action={formAction} className="space-y-2">
			<input type="hidden" name="share" value="off" />
			{sure ? (
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
					<Button
						type="submit"
						variant="danger"
						pending={pending}
						pendingLabel="Stopping"
					>
						Stop, and delete what it gave
					</Button>
					<button
						type="button"
						onClick={() => setSure(false)}
						className="text-ink-soft text-sm underline hover:text-palace-700"
					>
						Keep sharing
					</button>
				</div>
			) : (
				<Button type="button" variant="danger" onClick={() => setSure(true)}>
					Stop sharing
				</Button>
			)}
			<Outcome state={state} />
		</form>
	);
}

/** From an article: words for a site admin, behind a disclosure. */
export function SuggestSomething({ slug }: { slug: string }) {
	const [state, formAction, pending] = useActionState(suggestSomething, null);
	if (state?.ok) return <Outcome state={state} />;
	return (
		<details className="group">
			<summary className="flex min-h-tap cursor-pointer list-none items-center gap-1.5 text-ink-soft text-sm hover:text-palace-700">
				<Icon name="pencil" className="h-4 w-4" />
				<span className="underline decoration-dotted underline-offset-2">
					Suggest something
				</span>
			</summary>
			<form action={formAction} className="mt-1 space-y-2">
				<input type="hidden" name="slug" value={slug} />
				<Field
					label="What should figgy know?"
					hint="A site admin reads it. Names are taken out before they do."
				>
					<textarea
						name="text"
						rows={3}
						required
						minLength={3}
						maxLength={1000}
						placeholder="Ours never set fruit until we moved them out of the afternoon sun."
						className={textareaClass}
					/>
				</Field>
				<div className="flex flex-wrap items-center gap-3">
					<Button type="submit" pending={pending} pendingLabel="Sending">
						Send to the library
					</Button>
					<Outcome state={state} />
				</div>
			</form>
		</details>
	);
}
