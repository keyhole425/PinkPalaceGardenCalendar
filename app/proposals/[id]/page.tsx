import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProposalReview } from '@/components/ai/ProposalReview';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
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
		<Frame width="list">
			<PageHeader
				back={{ href: '/plants', label: '\u2190 Plants' }}
				title={stored.query}
				description={
					<>
						Looked up {formatLong(stored.createdAt.slice(0, 10))} by {stored.model}
						{stored.costCents > 0 && ` · cost ${stored.costCents.toFixed(1)}¢`}
						{stored.proposal &&
							` · ${overallConfidence(stored.proposal)} confidence overall`}
					</>
				}
			/>

			<div className="space-y-rhythm">
				{stored.status === 'failed' && (
					<Callout tone="warn">
						<p className="font-medium">That didn&rsquo;t work.</p>
						<p className="text-ink-soft">{stored.error}</p>
						<p className="mt-2">
							Nothing was saved.{' '}
							<Link href="/plants/new" className="underline">
								Try again
							</Link>{' '}
							or add the plant by hand.
						</p>
					</Callout>
				)}

				{stored.status === 'accepted' && (
					<Callout tone="good">
						Accepted
						{stored.reviewedAt &&
							` on ${formatLong(stored.reviewedAt.slice(0, 10))}`}
						.{' '}
						{stored.plantSlug && (
							<Link href={`/plants/${stored.plantSlug}`} className="underline">
								See the plant
							</Link>
						)}
					</Callout>
				)}

				{stored.status === 'rejected' && (
					<Callout tone="quiet">
						Thrown away. Nothing was written to the schedule.
					</Callout>
				)}

				{stored.status === 'ready' && stored.proposal && (
					<>
						<Callout tone="note" className="max-w-measure">
							None of this is in your schedule yet. Untick anything you disagree
							with, then accept the rest &mdash; you can edit it all afterwards.
						</Callout>
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
					<EmptyState>Still reading around. Refresh in a moment.</EmptyState>
				)}
			</div>
		</Frame>
	);
}
