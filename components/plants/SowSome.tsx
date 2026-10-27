'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { sowInBed } from '@/actions/beds';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, selectClass } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { formatLong, type IsoDate, plusDays } from '@/lib/dates';
import type { SowPlace } from '@/lib/db/queries/library';

/**
 * Putting a plant just added from the library into the ground, without
 * leaving its page.
 *
 * Only where and when are asked. A bed laid out in spots takes its first
 * free one - moving it is a tap on the bed's own page - so the common case
 * stays a single choice and one button. Sowing goes through the same action
 * as a bed's own Sow something, rotation warning and all.
 */
export function SowSome({
	slug,
	plantTypeId,
	places,
	today,
}: {
	slug: string;
	plantTypeId: number;
	places: SowPlace[];
	today: IsoDate;
}) {
	const [state, formAction, pending] = useActionState(sowInBed, null);
	const open = places.filter((p) => !p.full);
	const [placeId, setPlaceId] = useState(String(open[0]?.id ?? ''));
	const [sownOn, setSownOn] = useState<IsoDate>(today);
	const place = open.find((p) => String(p.id) === placeId);

	if (state?.ok) {
		return (
			<p className="flex items-start gap-2 rounded-md border border-fertilise bg-fertilise-soft p-3 text-sm">
				<Icon
					name="check"
					className="mt-0.5 h-4 w-4 shrink-0 text-fertilise-deep"
				/>
				<span>
					{state.warning ?? 'Sown.'}{' '}
					{place && (
						<Link
							href={`/garden/${place.slug}`}
							className="underline hover:text-palace-700"
						>
							See it in {place.name}
						</Link>
					)}
				</span>
			</p>
		);
	}

	const shortcut = (date: IsoDate, text: string) => (
		<button
			type="button"
			onClick={() => setSownOn(date)}
			aria-pressed={sownOn === date}
			className={`min-h-8 rounded-md border px-2 text-xs ${
				sownOn === date
					? 'border-palace-500 bg-palace-200 font-medium text-palace-700'
					: 'border-rule bg-paper text-ink-soft hover:border-palace-300'
			}`}
		>
			{text}
		</button>
	);

	return (
		<Card
			as="form"
			title="Sow some"
			id="sow-some"
			action={formAction}
			className="scroll-mt-6"
		>
			{open.length === 0 ? (
				<p className="text-ink-soft text-sm">
					Every place is full.{' '}
					<Link href="/garden" className="underline hover:text-palace-700">
						Clear a spot in the garden
					</Link>{' '}
					and come back.
				</p>
			) : (
				<>
					<input type="hidden" name="plantTypeId" value={plantTypeId} />
					<input type="hidden" name="sownOn" value={sownOn} />
					{place?.spot && (
						<>
							<input type="hidden" name="posX" value={place.spot.x} />
							<input type="hidden" name="posY" value={place.spot.y} />
						</>
					)}
					<Field label="Where">
						<select
							name="environmentId"
							value={placeId}
							onChange={(e) => setPlaceId(e.target.value)}
							className={selectClass}
						>
							{open.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</select>
					</Field>
					<div className="space-y-1.5">
						<p className="text-ink-soft text-sm">Sown</p>
						<div className="flex flex-wrap items-center gap-1.5">
							{shortcut(today, 'Today')}
							{shortcut(plusDays(today, -1), 'Yesterday')}
							<span className="text-ink-soft text-xs">{formatLong(sownOn)}</span>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
						<Button type="submit" pending={pending} pendingLabel="Sowing">
							Sow it
						</Button>
						{/* Leaving the form is leaving the page that offered it. */}
						<Link
							href={`/plants/${slug}`}
							className="text-ink-soft text-sm underline hover:text-palace-700"
						>
							Plant it later
						</Link>
					</div>
					{state && !state.ok && (
						<p className="text-prune-deep text-sm">{state.error}</p>
					)}
				</>
			)}
		</Card>
	);
}
