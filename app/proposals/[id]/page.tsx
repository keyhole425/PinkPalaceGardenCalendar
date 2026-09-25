import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProposalReview } from '@/components/ai/ProposalReview';
import { getProposal } from '@/lib/ai/proposals';
import { overallConfidence } from '@/lib/ai/schema';
import { formatLong, monthOf, today } from '@/lib/dates';
import { listEnvironments } from '@/lib/db/queries/plant';
import type { Month } from '@/lib/schedule/months';

export const dynamic = 'force-dynamic';

export default async function ProposalPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const stored = getProposal(Number(id));
	if (!stored) notFound();

	const currentMonth = monthOf(today()) as Month;
	const environments = listEnvironments();

	return (
		<div className="space-y-6">
			<header className="space-y-1">
				<p className="text-ink-soft text-sm">
					<Link href="/plants" className="hover:text-palace-700">
						Plants
					</Link>
				</p>
				<h1 className="font-semibold text-2xl">{stored.query}</h1>
				<p className="text-ink-soft text-sm">
					Looked up {formatLong(stored.createdAt.slice(0, 10))} by {stored.model}
					{stored.costCents > 0 && ` · cost ${stored.costCents.toFixed(1)}¢`}
					{stored.proposal &&
						` · ${overallConfidence(stored.proposal)} confidence overall`}
				</p>
			</header>

			{stored.status === 'failed' && (
				<div className="rounded-md border border-prune/40 bg-prune-soft p-3 text-sm">
					<p className="font-medium">That didn&rsquo;t work.</p>
					<p className="text-ink-soft">{stored.error}</p>
					<p className="mt-2">
						Nothing was saved.{' '}
						<Link href="/plants/new" className="underline">
							Try again
						</Link>{' '}
						or add the plant by hand.
					</p>
				</div>
			)}

			{stored.status === 'accepted' && (
				<div className="rounded-md border border-fertilise/40 bg-fertilise-soft p-3 text-sm">
					Accepted
					{stored.reviewedAt && ` on ${formatLong(stored.reviewedAt.slice(0, 10))}`}
					.{' '}
					{stored.plantSlug && (
						<Link href={`/plants/${stored.plantSlug}`} className="underline">
							See the plant
						</Link>
					)}
				</div>
			)}

			{stored.status === 'rejected' && (
				<div className="rounded-md border border-rule bg-paper-sunk p-3 text-sm">
					Thrown away. Nothing was written to the schedule.
				</div>
			)}

			{stored.status === 'ready' && stored.proposal && (
				<>
					<p className="max-w-2xl rounded-md border border-palace-300 bg-palace-50 p-3 text-sm">
						None of this is in your schedule yet. Untick anything you disagree with,
						then accept the rest &mdash; you can edit it all afterwards.
					</p>
					<ProposalReview
						proposalId={stored.id}
						proposal={stored.proposal}
						citations={stored.citations}
						currentMonth={currentMonth}
						environments={environments}
						isNewPlant={stored.plantTypeId === null}
						notes={stored.notes}
					/>
				</>
			)}

			{stored.status === 'running' && (
				<p className="rounded-md border border-rule border-dashed p-3 text-sm">
					Still reading around. Refresh in a moment.
				</p>
			)}
		</div>
	);
}
