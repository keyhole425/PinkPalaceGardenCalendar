import { count, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataList, DataRow } from '@/components/ui/DataList';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { aiAvailable, MODEL } from '@/lib/ai/client';
import { listProposals, totalSpendCents } from '@/lib/ai/proposals';
import { requireHousehold } from '@/lib/auth/context';
import { db, dbUrl, describeDbUrl } from '@/lib/db/client';
import { careLog, careRule, household, planting, plantType } from '@/lib/db/schema';
import { owns } from '@/lib/db/tenancy';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
	const { householdId } = await requireHousehold();
	// Counted in the database rather than by fetching every row: the log only
	// grows, and every row would otherwise cross the network to be counted.
	const [[plants], [plantings], [rules], [log]] = await Promise.all(
		[plantType, planting, careRule, careLog].map((table) =>
			db.select({ n: count() }).from(table).where(owns(table, householdId)).all(),
		),
	);
	const counts = {
		plants: plants?.n ?? 0,
		plantings: plantings?.n ?? 0,
		rules: rules?.n ?? 0,
		log: log?.n ?? 0,
	};
	const home = await db
		.select({ seedVersion: household.seedVersion })
		.from(household)
		.where(eq(household.id, householdId))
		.get();
	const seedVersion = home?.seedVersion ?? 'unknown';
	const spend = await totalSpendCents(householdId);
	const proposals = await listProposals(householdId, 10);

	return (
		<Frame width="list">
			<PageHeader title="Settings" />

			<div className="space-y-rhythm">
				<Card title="The database">
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm tabular-nums">
						<dt className="text-ink-soft">Where</dt>
						<dd className="break-all font-mono text-xs">{describeDbUrl(dbUrl)}</dd>
						<dt className="text-ink-soft">Plants</dt>
						<dd>{counts.plants}</dd>
						<dt className="text-ink-soft">Growing</dt>
						<dd>{counts.plantings}</dd>
						<dt className="text-ink-soft">Rules</dt>
						<dd>{counts.rules}</dd>
						<dt className="text-ink-soft">Things recorded</dt>
						<dd>{counts.log}</dd>
						<dt className="text-ink-soft">Seed version</dt>
						<dd>{seedVersion}</dd>
					</dl>
				</Card>

				<Card title="Looking things up">
					{aiAvailable() ? (
						<p className="text-sm">
							Switched on, using {MODEL}. Spent so far:{' '}
							<strong>
								{spend < 100
									? `${spend.toFixed(1)}¢`
									: `$${(spend / 100).toFixed(2)}`}
							</strong>{' '}
							<span className="text-ink-soft">
								(tokens only; web search is billed separately)
							</span>
							.
						</p>
					) : (
						<p className="text-sm">
							Switched off &mdash; no{' '}
							<code className="font-mono">ANTHROPIC_API_KEY</code>. Everything else
							works without one.
						</p>
					)}

					{proposals.length > 0 && (
						<DataList>
							{proposals.map((p) => (
								<DataRow key={p.id} action={<Badge tone="quiet">{p.status}</Badge>}>
									<Link
										href={`/proposals/${p.id}`}
										className="font-medium hover:text-palace-700"
									>
										{p.query}
									</Link>
									<span className="text-ink-soft text-xs">{p.createdAt}</span>
								</DataRow>
							))}
						</DataList>
					)}
				</Card>
			</div>
		</Frame>
	);
}
