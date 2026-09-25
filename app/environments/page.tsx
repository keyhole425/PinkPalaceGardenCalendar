import { EnvironmentForm } from '@/components/plants/EnvironmentForm';
import { listEnvironments } from '@/lib/db/queries/plant';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
	orchard: 'Orchard',
	bed: 'Bed',
	hothouse: 'Hothouse',
	pot: 'Pot',
};

export default async function EnvironmentsPage() {
	const environments = listEnvironments();

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-semibold text-2xl">Where things grow</h1>
				<p className="max-w-2xl text-ink-soft text-sm">
					The same plant wants different things in different places. A hothouse runs
					ahead of the open garden, so figgy shifts its windows to match.
				</p>
			</div>

			<ul className="divide-y divide-rule border border-rule">
				{environments.map((e) => (
					<li
						key={e.id}
						className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm"
					>
						<span className="font-medium">{e.name}</span>
						<span className="text-ink-soft">{KIND_LABEL[e.kind] ?? e.kind}</span>
						{e.frostFree && (
							<span className="rounded-full bg-fertilise-soft px-2 py-0.5 text-xs">
								frost free
							</span>
						)}
						{e.windowShiftMonths !== 0 && (
							<span className="rounded-full bg-palace-100 px-2 py-0.5 text-palace-700 text-xs">
								{Math.abs(e.windowShiftMonths)} month
								{Math.abs(e.windowShiftMonths) > 1 ? 's' : ''}{' '}
								{e.windowShiftMonths < 0 ? 'earlier' : 'later'}
							</span>
						)}
						{e.notes && (
							<span className="w-full text-ink-soft text-xs">{e.notes}</span>
						)}
					</li>
				))}
			</ul>

			<section className="space-y-2">
				<h2 className="font-semibold text-lg">Add a place</h2>
				<EnvironmentForm />
			</section>
		</div>
	);
}
