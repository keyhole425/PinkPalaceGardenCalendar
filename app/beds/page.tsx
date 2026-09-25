import Link from 'next/link';
import { BedPlan } from '@/components/beds/BedPlan';
import { listBeds } from '@/lib/db/queries/beds';

export const dynamic = 'force-dynamic';

export default async function BedsPage() {
	const beds = listBeds();

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-semibold text-2xl">Beds and the hothouse</h1>
				<p className="max-w-2xl text-ink-soft text-sm">
					Tap a spot to sow something in it. Where a place runs ahead of the open
					garden, figgy moves its windows to match.
				</p>
			</div>

			{beds.length === 0 && (
				<p className="rounded-md border border-rule border-dashed p-3 text-ink-soft text-sm">
					No beds yet. Add one on{' '}
					<Link href="/environments" className="underline">
						Places
					</Link>
					.
				</p>
			)}

			<div className="grid gap-6 md:grid-cols-2">
				{beds.map((bed) => (
					<section key={bed.id} className="space-y-2">
						<h2 className="flex flex-wrap items-baseline gap-2 font-semibold text-lg">
							<Link href={`/beds/${bed.slug}`} className="hover:text-palace-700">
								{bed.name}
							</Link>
							{bed.frostFree && (
								<span className="rounded-full bg-fertilise-soft px-2 py-0.5 font-normal text-xs">
									frost free
								</span>
							)}
							{bed.windowShiftMonths !== 0 && (
								<span className="rounded-full bg-palace-100 px-2 py-0.5 font-normal text-palace-700 text-xs">
									{Math.abs(bed.windowShiftMonths)} month
									{Math.abs(bed.windowShiftMonths) > 1 ? 's' : ''}{' '}
									{bed.windowShiftMonths < 0 ? 'ahead' : 'behind'}
								</span>
							)}
						</h2>
						<BedPlan bed={bed} href={() => `/beds/${bed.slug}`} />
					</section>
				))}
			</div>
		</div>
	);
}
