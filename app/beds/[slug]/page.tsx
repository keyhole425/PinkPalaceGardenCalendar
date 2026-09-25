import { and, asc, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BedPlan } from '@/components/beds/BedPlan';
import type { SowablePlant } from '@/components/beds/SowForm';
import { ClearButton, SowForm } from '@/components/beds/SowForm';
import { formatLong, monthOf, today } from '@/lib/dates';
import { db } from '@/lib/db/client';
import { getBed, getBedHistory, rotationWarningFor } from '@/lib/db/queries/beds';
import { careRule, plantType } from '@/lib/db/schema';
import { hasMonth, type Month, shiftMask } from '@/lib/schedule/months';

export const dynamic = 'force-dynamic';

/**
 * Which crops could go in here this month.
 *
 * The same shift the schedule engine applies is applied here, so a bed that
 * runs a month ahead offers you next month's sowings now - which is the whole
 * point of having a hothouse.
 */
function sowableNow(
	environmentKind: string,
	shiftMonths: number,
	month: Month,
): SowablePlant[] {
	const rows = db
		.select({
			id: plantType.id,
			commonName: plantType.commonName,
			family: plantType.family,
			monthMask: careRule.monthMask,
			environmentKind: careRule.environmentKind,
		})
		.from(plantType)
		.leftJoin(
			careRule,
			and(
				eq(careRule.plantTypeId, plantType.id),
				eq(careRule.action, 'sow'),
				isNull(careRule.plantingId),
				eq(careRule.active, true),
			),
		)
		.orderBy(asc(plantType.commonName))
		.all();

	const byPlant = new Map<number, SowablePlant>();
	for (const row of rows) {
		const existing = byPlant.get(row.id);
		let inSeason = existing?.inSeason ?? false;
		let shifted = existing?.shifted ?? false;

		if (row.monthMask !== null) {
			const specific = row.environmentKind === environmentKind;
			const shift = specific ? 0 : shiftMonths;
			const effective = shiftMask(row.monthMask, shift);
			if (hasMonth(effective, month)) {
				inSeason = true;
				// Brought forward only if it would not otherwise be open now.
				shifted = shifted || (shift !== 0 && !hasMonth(row.monthMask, month));
			}
		}

		byPlant.set(row.id, {
			id: row.id,
			commonName: row.commonName,
			family: row.family,
			inSeason,
			shifted,
		});
	}

	return [...byPlant.values()];
}

export default async function BedPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const bed = getBed(slug);
	if (!bed) notFound();

	const when = today();
	const month = monthOf(when);
	const history = getBedHistory(bed.id);
	const plants = sowableNow(bed.kind, bed.windowShiftMonths, month);

	// Every family grown here lately, so the form can say so before you plant a
	// cousin rather than after.
	const families = [
		...new Set(
			getBedHistory(bed.id)
				.map((h) => h.family)
				.filter(Boolean),
		),
	] as string[];
	const warnings = families
		.map((family) => rotationWarningFor(bed.id, family, when))
		.filter((w) => w !== null);
	const recentFamilies = warnings.map((w) => ({
		family: w.family,
		what: w.what,
		when: w.lastSeen.match(/^\d{4}-\d{2}-\d{2}$/)
			? formatLong(w.lastSeen)
			: w.lastSeen,
	}));

	return (
		<div className="space-y-6">
			<header className="space-y-1">
				<p className="text-ink-soft text-sm">
					<Link href="/beds" className="hover:text-palace-700">
						Beds
					</Link>
				</p>
				<h1 className="font-semibold text-2xl">{bed.name}</h1>
				<p className="text-ink-soft text-sm">
					{bed.widthCm && bed.lengthCm && `${bed.widthCm} × ${bed.lengthCm} cm · `}
					{bed.gridCols} × {bed.gridRows} spots
					{bed.frostFree && ' · frost free'}
					{bed.windowShiftMonths !== 0 &&
						` · runs ${Math.abs(bed.windowShiftMonths)} month${
							Math.abs(bed.windowShiftMonths) > 1 ? 's' : ''
						} ${bed.windowShiftMonths < 0 ? 'ahead of' : 'behind'} the open garden`}
				</p>
				{bed.notes && <p className="max-w-2xl text-sm">{bed.notes}</p>}
			</header>

			<BedPlan bed={bed} />

			<section className="space-y-2">
				<h2 className="font-semibold text-lg">Sow something</h2>
				<SowForm
					environmentId={bed.id}
					plants={plants}
					today={when}
					cols={bed.gridCols}
					rows={bed.gridRows}
					recentFamilies={recentFamilies}
				/>
			</section>

			<section className="space-y-2">
				<h2 className="font-semibold text-lg">Growing here now</h2>
				{bed.occupants.length === 0 ? (
					<p className="rounded-md border border-rule border-dashed p-3 text-ink-soft text-sm">
						Empty.
					</p>
				) : (
					<ul className="divide-y divide-rule border border-rule">
						{bed.occupants.map((o) => (
							<li
								key={o.plantingId}
								className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm"
							>
								<Link
									href={`/plants/${o.plantSlug}`}
									className="font-medium hover:text-palace-700"
								>
									{o.label}
								</Link>
								{o.sownOn && (
									<span className="text-ink-soft">sown {formatLong(o.sownOn)}</span>
								)}
								{o.readyFrom && o.readyTo && (
									<span className="rounded-full bg-harvest-soft px-2 py-0.5 text-xs">
										ready about {formatLong(o.readyFrom)} &ndash;{' '}
										{formatLong(o.readyTo)}
									</span>
								)}
								<span className="ml-auto">
									<ClearButton plantingId={o.plantingId} slug={bed.slug} />
								</span>
							</li>
						))}
					</ul>
				)}
			</section>

			{warnings.length > 0 && (
				<section className="space-y-1">
					<h2 className="font-semibold text-lg">Rotation</h2>
					<ul className="space-y-1 text-sm">
						{warnings.map((w) => (
							<li
								key={w.family}
								className="rounded-md border border-prune/40 bg-prune-soft p-2"
							>
								<strong>{w.family}</strong> has been here recently ({w.what},{' '}
								{w.lastSeen.match(/^\d{4}-\d{2}-\d{2}$/)
									? formatLong(w.lastSeen)
									: w.lastSeen}
								). Give the bed something from another family next.
							</li>
						))}
					</ul>
				</section>
			)}

			<section className="space-y-2">
				<h2 className="font-semibold text-lg">What has grown here</h2>
				{history.length === 0 ? (
					<p className="rounded-md border border-rule border-dashed p-3 text-ink-soft text-sm">
						Nothing yet.
					</p>
				) : (
					<ol className="divide-y divide-rule border border-rule">
						{history.map((h) => (
							<li
								key={h.plantingId}
								className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-sm"
							>
								<span className="font-medium">{h.plantName}</span>
								{h.family && (
									<span className="text-ink-soft text-xs">{h.family}</span>
								)}
								<span className="text-ink-soft">
									{h.sownOn ? `sown ${formatLong(h.sownOn)}` : 'undated'}
									{h.removedOn && ` · cleared ${formatLong(h.removedOn)}`}
								</span>
								{h.status !== 'active' && (
									<span className="ml-auto rounded-full bg-paper-sunk px-2 py-0.5 text-ink-soft text-xs">
										{h.status}
									</span>
								)}
							</li>
						))}
					</ol>
				)}
			</section>
		</div>
	);
}
