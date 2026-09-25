import fs from 'node:fs';
import Link from 'next/link';
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

export default async function SettingsPage() {
	const counts = {
		plants: db.select().from(plantType).all().length,
		plantings: db.select().from(planting).all().length,
		rules: db.select().from(careRule).all().length,
		log: db.select().from(careLog).all().length,
	};
	const seedVersion =
		db
			.select()
			.from(meta)
			.all()
			.find((m) => m.key === 'seed_version')?.value ?? 'unknown';
	const spend = totalSpendCents();
	const proposals = listProposals(10);

	return (
		<div className="space-y-6">
			<h1 className="font-semibold text-2xl">Settings</h1>

			<section className="space-y-2">
				<h2 className="font-semibold text-lg">The database</h2>
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
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
			</section>

			<section className="space-y-2">
				<h2 className="font-semibold text-lg">Looking things up</h2>
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
						Switched off &mdash; no <code>ANTHROPIC_API_KEY</code>. Everything else
						works without one.
					</p>
				)}

				{proposals.length > 0 && (
					<ul className="divide-y divide-rule border border-rule">
						{proposals.map((p) => (
							<li
								key={p.id}
								className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-sm"
							>
								<Link
									href={`/proposals/${p.id}`}
									className="font-medium hover:text-palace-700"
								>
									{p.query}
								</Link>
								<span className="text-ink-soft text-xs">{p.createdAt}</span>
								<span className="ml-auto rounded-full bg-paper-sunk px-2 py-0.5 text-ink-soft text-xs">
									{p.status}
								</span>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
