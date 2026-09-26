import fs from 'node:fs';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataList, DataRow } from '@/components/ui/DataList';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { aiAvailable, MODEL } from '@/lib/ai/client';
import { listProposals, totalSpendCents } from '@/lib/ai/proposals';
import { db, dbPath } from '@/lib/db/client';
import { careLog, careRule, meta, planting, plantType } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

function sizeOnDisk(): string {
	try {
		const bytes = fs.statSync(dbPath).size;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	} catch {
		return 'not found';
	}
}

function describeAge(iso: string): string {
	const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
	if (days <= 0) return 'today';
	if (days === 1) return 'yesterday';
	return `${days} days ago`;
}

/** Two days without a snapshot means the job is probably not running. */
function staleBackup(iso: string): boolean {
	return Date.now() - Date.parse(iso) > 2 * 86_400_000;
}

export default async function SettingsPage() {
	const counts = {
		plants: db.select().from(plantType).all().length,
		plantings: db.select().from(planting).all().length,
		rules: db.select().from(careRule).all().length,
		log: db.select().from(careLog).all().length,
	};
	const metaRows = db.select().from(meta).all();
	const seedVersion =
		metaRows.find((m) => m.key === 'seed_version')?.value ?? 'unknown';
	const lastBackup = metaRows.find((m) => m.key === 'last_backup_at')?.value;
	const spend = totalSpendCents();
	const proposals = listProposals(10);

	return (
		<Frame width="list">
			<PageHeader title="Settings" />

			<div className="space-y-rhythm">
				<Card title="The database">
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm tabular-nums">
						<dt className="text-ink-soft">File</dt>
						<dd className="break-all font-mono text-xs">{dbPath}</dd>
						<dt className="text-ink-soft">Size</dt>
						<dd>{sizeOnDisk()}</dd>
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

				<Card title="Backups">
					{lastBackup ? (
						<p className="text-sm">
							Last backed up <strong>{describeAge(lastBackup)}</strong>{' '}
							<span className="text-ink-soft">
								({lastBackup.slice(0, 16).replace('T', ' ')})
							</span>
							.
							{staleBackup(lastBackup) && (
								<Badge tone="warn" className="ml-2">
									that is getting old
								</Badge>
							)}
						</p>
					) : (
						<p className="text-sm">
							No backup has ever run.{' '}
							<span className="text-ink-soft">
								<code className="font-mono">npm run backup</code>, or bring the
								container up, which runs one daily.
							</span>
						</p>
					)}
					<p className="text-ink-soft text-xs">
						Snapshots are taken with SQLite&rsquo;s backup API and written to{' '}
						<code className="font-mono">backups/</code>. A plain file copy of a WAL
						database is not a backup, so figgy never makes one.
					</p>
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
