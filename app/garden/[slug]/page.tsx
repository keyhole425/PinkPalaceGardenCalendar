import { and, asc, eq, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BedPlan } from '@/components/beds/BedPlan';
import type { SowablePlant } from '@/components/beds/SowForm';
import { ClearButton, SowForm } from '@/components/beds/SowForm';
import { Badge } from '@/components/ui/Badge';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { DataList, DataRow } from '@/components/ui/DataList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
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
		<Frame width="list">
			<PageHeader
				back={{ href: '/garden', label: '\u2190 The garden' }}
				title={bed.name}
				description={
					<>
						{bed.widthCm &&
							bed.lengthCm &&
							`${bed.widthCm} × ${bed.lengthCm} cm · `}
						{bed.gridCols} × {bed.gridRows} spots
						{bed.frostFree && ' · frost free'}
						{bed.windowShiftMonths !== 0 &&
							` · runs ${Math.abs(bed.windowShiftMonths)} month${
								Math.abs(bed.windowShiftMonths) > 1 ? 's' : ''
							} ${bed.windowShiftMonths < 0 ? 'ahead of' : 'behind'} the open garden`}
						{bed.notes && <span className="mt-1 block text-ink">{bed.notes}</span>}
					</>
				}
			/>

			<div className="space-y-rhythm">
				<BedPlan bed={bed} />

				<Card title="Sow something">
					<SowForm
						environmentId={bed.id}
						plants={plants}
						today={when}
						cols={bed.gridCols}
						rows={bed.gridRows}
						recentFamilies={recentFamilies}
					/>
				</Card>

				<Card title="Growing here now" count={bed.occupants.length}>
					{bed.occupants.length === 0 ? (
						<EmptyState>Empty.</EmptyState>
					) : (
						<DataList>
							{bed.occupants.map((o) => (
								<DataRow
									key={o.plantingId}
									action={<ClearButton plantingId={o.plantingId} slug={bed.slug} />}
								>
									<Link
										href={`/plants/${o.plantSlug}`}
										className="font-medium hover:text-palace-700"
									>
										{o.label}
									</Link>
									{o.sownOn && (
										<span className="text-ink-soft">
											sown {formatLong(o.sownOn)}
										</span>
									)}
									{o.readyFrom && o.readyTo && (
										<Badge tone="harvest">
											ready about {formatLong(o.readyFrom)} &ndash;{' '}
											{formatLong(o.readyTo)}
										</Badge>
									)}
								</DataRow>
							))}
						</DataList>
					)}
				</Card>

				{warnings.length > 0 && (
					<Card title="Rotation">
						<ul className="space-y-1">
							{warnings.map((w) => (
								<li key={w.family}>
									<Callout tone="warn">
										<strong>{w.family}</strong> has been here recently ({w.what},{' '}
										{w.lastSeen.match(/^\d{4}-\d{2}-\d{2}$/)
											? formatLong(w.lastSeen)
											: w.lastSeen}
										). Give the bed something from another family next.
									</Callout>
								</li>
							))}
						</ul>
					</Card>
				)}

				<Card title="What has grown here" count={history.length}>
					{history.length === 0 ? (
						<EmptyState>Nothing yet.</EmptyState>
					) : (
						<DataList as="ol">
							{history.map((h) => (
								<DataRow
									key={h.plantingId}
									action={
										h.status !== 'active' ? (
											<Badge tone="quiet">{h.status}</Badge>
										) : undefined
									}
								>
									<span className="font-medium">{h.plantName}</span>
									{h.family && (
										<span className="text-ink-soft text-xs">{h.family}</span>
									)}
									<span className="text-ink-soft">
										{h.sownOn ? `sown ${formatLong(h.sownOn)}` : 'undated'}
										{h.removedOn && ` · cleared ${formatLong(h.removedOn)}`}
									</span>
								</DataRow>
							))}
						</DataList>
					)}
				</Card>
			</div>
		</Frame>
	);
}
