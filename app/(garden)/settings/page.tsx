import { count, eq } from 'drizzle-orm';
import Link from 'next/link';
import { CheckKey, RemoveKey, SaveKey } from '@/components/settings/AiKeyForms';
import {
	InviteForm,
	MemberControls,
	RenameHousehold,
	SignOutButton,
	TakeTheTourAgain,
	WithdrawInvite,
} from '@/components/settings/HouseholdForms';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataList, DataRow } from '@/components/ui/DataList';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { MODEL } from '@/lib/ai/client';
import { listProposals, totalSpendCents } from '@/lib/ai/proposals';
import { isSiteAdmin, requireHousehold } from '@/lib/auth/context';
import { db, dbUrl, describeDbUrl } from '@/lib/db/client';
import { listMembers } from '@/lib/db/queries/household';
import {
	careLog,
	careRule,
	household,
	householdAiCredential,
	planting,
	plantType,
} from '@/lib/db/schema';
import { owns } from '@/lib/db/tenancy';
import { listPendingInvites, type PendingInvite } from '@/lib/invites';

export const dynamic = 'force-dynamic';

function Pending({ invites }: { invites: PendingInvite[] }) {
	if (invites.length === 0) return null;
	return (
		<DataList>
			{invites.map((i) => (
				<DataRow key={i.id} action={<WithdrawInvite id={i.id} />}>
					<span>{i.email ?? 'Anyone with the link'}</span>
					{i.kind === 'join_household' && i.role === 'admin' && (
						<Badge tone="quiet">admin</Badge>
					)}
					<span className="text-ink-soft text-xs">
						until{' '}
						{new Date(i.expiresAt).toLocaleDateString('en-AU', {
							day: 'numeric',
							month: 'long',
						})}
					</span>
				</DataRow>
			))}
		</DataList>
	);
}

export default async function SettingsPage() {
	const ctx = await requireHousehold();
	const { householdId } = ctx;
	const admin = ctx.role === 'admin';
	const siteAdmin = await isSiteAdmin(ctx.userId);
	const [members, invites, gardenInvites, key] = await Promise.all([
		listMembers(householdId),
		admin ? listPendingInvites(householdId) : [],
		siteAdmin ? listPendingInvites(null) : [],
		// Never the sealed key itself: only what the page is allowed to say.
		db
			.select({
				keyLast4: householdAiCredential.keyLast4,
				checkOk: householdAiCredential.checkOk,
			})
			.from(householdAiCredential)
			.where(eq(householdAiCredential.householdId, householdId))
			.get(),
	]);
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
				<Card
					title={ctx.householdName}
					count={members.length}
					data-tour="household"
				>
					{admin && <RenameHousehold name={ctx.householdName} />}
					<DataList>
						{members.map((m) => (
							<DataRow
								key={m.userId}
								action={
									admin && m.userId !== ctx.userId ? (
										<MemberControls userId={m.userId} name={m.name} role={m.role} />
									) : undefined
								}
							>
								<span className="font-medium">{m.name}</span>
								{m.userId === ctx.userId && (
									<span className="text-ink-soft text-xs">you</span>
								)}
								{m.role === 'admin' && <Badge tone="quiet">admin</Badge>}
								<span className="break-all text-ink-soft text-xs">{m.email}</span>
							</DataRow>
						))}
					</DataList>
					{admin ? (
						<div className="space-y-2" data-tour="invite">
							<h3 className="pt-2 font-medium text-sm">Invite someone in</h3>
							<p className="text-ink-soft text-sm">
								They will see this garden and can look after it with you. Admins can
								also invite and remove people.
							</p>
							<InviteForm kind="household" />
							<Pending invites={invites} />
						</div>
					) : (
						<p className="text-ink-soft text-sm">
							To bring someone else in, ask an admin of this household.
						</p>
					)}
				</Card>

				{siteAdmin && (
					<Card title="New gardens" data-tour="new-gardens">
						<p className="text-ink-soft text-sm">
							An invite that starts a garden of its own, for a friend rather than
							this household. Only site admins see this.
						</p>
						<InviteForm kind="garden" />
						<Pending invites={gardenInvites} />
					</Card>
				)}

				<Card title="This garden in figgy">
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm tabular-nums">
						{siteAdmin && (
							<>
								<dt className="text-ink-soft">Database</dt>
								<dd className="break-all font-mono text-xs">
									{describeDbUrl(dbUrl)}
								</dd>
							</>
						)}
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

				<Card title="Looking things up" id="looking-things-up" data-tour="ai-key">
					{key ? (
						<p className="text-sm">
							Switched on, using {MODEL} on this household&rsquo;s key ending{' '}
							<code className="font-mono">{key.keyLast4}</code>
							{key.checkOk === false && (
								<Badge tone="strong" className="ml-2">
									last check failed
								</Badge>
							)}
							. Spent so far:{' '}
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
							Switched off. figgy can research a plant, answer questions about the
							garden and read a sentence like &ldquo;pruned the fig&rdquo;, but each
							of those asks Claude, and Claude needs an Anthropic API key. The whole
							household shares one, and Anthropic bills it. Everything else works
							without one.
						</p>
					)}

					{admin ? (
						<div className="space-y-3">
							<SaveKey replacing={key !== undefined} />
							{key && (
								<div className="flex flex-wrap items-start gap-x-6 gap-y-2">
									<CheckKey />
									<RemoveKey />
								</div>
							)}
						</div>
					) : (
						!key && (
							<p className="text-ink-soft text-sm">
								An admin of this household can add one here.
							</p>
						)
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

				<Card title="You">
					<p className="text-sm">
						Signed in as <strong>{ctx.userName}</strong>.
					</p>
					<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
						<TakeTheTourAgain />
						<SignOutButton />
					</div>
				</Card>
			</div>
		</Frame>
	);
}
