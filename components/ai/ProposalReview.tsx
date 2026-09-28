'use client';

import { useActionState, useState } from 'react';
import { acceptProposal, rejectProposal } from '@/actions/research';
import { ActionChip } from '@/components/ui/ActionChip';
import { Button } from '@/components/ui/Button';
import { MonthStrip } from '@/components/ui/MonthStrip';
import type { Citation, PlantProposal } from '@/lib/ai/schema';
import {
	type Month,
	maskFromMonths,
	maskRuns,
	monthAbbr,
} from '@/lib/schedule/months';
import { Prose } from './Prose';

function windowLabel(months: number[]): string {
	return maskRuns(maskFromMonths(months))
		.map((r) =>
			r.start === r.end
				? monthAbbr(r.start)
				: `${monthAbbr(r.start)}–${monthAbbr(r.end)}`,
		)
		.join(', ');
}

const CONFIDENCE_CLASS: Record<string, string> = {
	high: 'bg-fertilise-soft text-ink',
	medium: 'bg-palace-100 text-palace-700',
	low: 'bg-prune-soft text-ink',
};

export function ProposalReview({
	proposalId,
	proposal,
	citations,
	currentMonth,
	environments,
	isNewPlant,
	notes,
}: {
	proposalId: number;
	proposal: PlantProposal;
	citations: Citation[];
	currentMonth: Month;
	environments: { id: number; name: string }[];
	isNewPlant: boolean;
	notes: string | null;
}) {
	const [acceptState, acceptAction, accepting] = useActionState(
		acceptProposal,
		null,
	);
	const [rejectState, rejectAction, rejecting] = useActionState(
		rejectProposal,
		null,
	);

	// Everything is ticked to start with, because the common case is that it
	// is right. Untick what you disagree with.
	const [chosen, setChosen] = useState<Set<number>>(
		new Set(proposal.rules.map((_, index) => index)),
	);
	const [plant, setPlant] = useState(isNewPlant);

	const toggle = (index: number) => {
		setChosen((current) => {
			const next = new Set(current);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	};

	return (
		<div className="space-y-6">
			<section className="space-y-2">
				<h2 className="font-semibold text-lg">What Claude found</h2>
				<p className="text-sm">{proposal.suitability}</p>
				{proposal.notesMd && (
					<blockquote className="border-palace-300 border-l-4 bg-palace-50 py-2 pl-3 text-sm">
						<Prose text={proposal.notesMd} />
					</blockquote>
				)}
			</section>

			{proposal.caveats.length > 0 && (
				<section className="space-y-1">
					<h2 className="font-semibold text-lg">Worth knowing</h2>
					<ul className="list-disc space-y-1 pl-5 text-sm">
						{proposal.caveats.map((caveat) => (
							<li key={caveat}>{caveat}</li>
						))}
					</ul>
				</section>
			)}

			<form action={acceptAction} className="space-y-4">
				<input type="hidden" name="proposalId" value={proposalId} />

				<section className="space-y-3">
					<h2 className="font-semibold text-lg">
						Proposed schedule
						<span className="ml-2 font-normal text-ink-soft text-sm">
							{chosen.size} of {proposal.rules.length} chosen
						</span>
					</h2>

					<ul className="space-y-3">
						{proposal.rules.map((rule, index) => (
							<li
								key={`${rule.action}-${rule.months.join('-')}`}
								className={`rounded-md border p-3 ${
									chosen.has(index)
										? 'border-rule bg-paper'
										: 'border-rule border-dashed bg-paper-sunk opacity-60'
								}`}
							>
								<label className="flex cursor-pointer items-start gap-3">
									<input
										type="checkbox"
										name="accept"
										value={index}
										checked={chosen.has(index)}
										onChange={() => toggle(index)}
										className="mt-1 h-5 w-5 shrink-0"
									/>
									<div className="min-w-0 flex-1 space-y-2">
										<div className="flex flex-wrap items-center gap-2">
											<ActionChip action={rule.action} />
											<MonthStrip
												action={rule.action}
												monthMask={maskFromMonths(rule.months)}
												currentMonth={currentMonth}
											/>
											<span className="text-sm">
												{windowLabel(rule.months)}
												{rule.alternatives && ' · one of these'}
												{rule.cadence === 'continuous' && ' · a season'}
											</span>
											<span
												className={`ml-auto rounded-full px-2 py-0.5 text-xs ${
													CONFIDENCE_CLASS[rule.confidence]
												}`}
											>
												{rule.confidence} confidence
											</span>
										</div>
										{rule.note && <p className="text-sm">{rule.note}</p>}
										<p className="text-ink-soft text-xs">{rule.reasoning}</p>
										{rule.sources.length > 0 && (
											<p className="flex flex-wrap gap-x-3 text-xs">
												{rule.sources.map((source) => (
													<a
														key={source}
														href={source}
														target="_blank"
														rel="noreferrer noopener"
														className="text-ink-soft underline hover:text-palace-700"
													>
														{hostOf(source)}
													</a>
												))}
											</p>
										)}
									</div>
								</label>
							</li>
						))}
					</ul>
				</section>

				{isNewPlant && (
					<section className="space-y-2 rounded-md border border-rule bg-paper-sunk p-3">
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={plant}
								onChange={(e) => setPlant(e.target.checked)}
								className="h-4 w-4"
							/>
							Plant one straight away
						</label>
						{plant && (
							<div className="flex flex-wrap gap-3">
								<label className="text-ink-soft text-xs">
									What you&rsquo;ll call it
									<input
										name="plantAs"
										defaultValue={proposal.commonName}
										className="mt-0.5 block min-h-tap rounded-md border border-rule bg-paper px-2 text-ink text-sm"
									/>
								</label>
								<label className="text-ink-soft text-xs">
									Where
									<select
										name="environmentId"
										className="mt-0.5 block min-h-tap rounded-md border border-rule bg-paper px-2 text-ink text-sm"
									>
										{environments.map((e) => (
											<option key={e.id} value={e.id}>
												{e.name}
											</option>
										))}
									</select>
								</label>
							</div>
						)}
					</section>
				)}

				<div className="flex flex-wrap items-center gap-3">
					<Button
						type="submit"
						disabled={chosen.size === 0}
						pending={accepting}
						pendingLabel="Saving"
					>
						{`Accept ${chosen.size} ${chosen.size === 1 ? 'window' : 'windows'}`}
					</Button>
					<span className="text-ink-soft text-sm">
						You can change any of it afterwards.
					</span>
					{acceptState && !acceptState.ok && (
						<span className="text-prune-deep text-sm">{acceptState.error}</span>
					)}
				</div>
			</form>

			<form action={rejectAction}>
				<input type="hidden" name="proposalId" value={proposalId} />
				<button
					type="submit"
					disabled={rejecting}
					className="text-ink-soft text-sm underline hover:text-prune-deep disabled:opacity-50"
				>
					{rejecting ? 'Discarding' : 'Throw this away'}
				</button>
				{rejectState && !rejectState.ok && (
					<span className="ml-2 text-prune-deep text-sm">{rejectState.error}</span>
				)}
			</form>

			<details className="rounded-md border border-rule p-3">
				<summary className="cursor-pointer text-ink-soft text-sm">
					Every page Claude read ({citations.length}), and its notes
				</summary>
				<ul className="mt-2 space-y-1 text-sm">
					{citations.map((c) => (
						<li key={c.url}>
							<a
								href={c.url}
								target="_blank"
								rel="noreferrer noopener"
								className="underline hover:text-palace-700"
							>
								{c.title}
							</a>
							<span className="ml-2 text-ink-soft text-xs">{hostOf(c.url)}</span>
						</li>
					))}
				</ul>
				{notes && (
					<div className="mt-3 border-rule border-t pt-3 text-ink-soft text-xs">
						<Prose text={notes} />
					</div>
				)}
			</details>
		</div>
	);
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}
