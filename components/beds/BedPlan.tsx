import Link from 'next/link';
import { formatShort } from '@/lib/dates';
import type { Bed } from '@/lib/db/queries/beds';

/**
 * A bed drawn as the grid of spots it is.
 *
 * Deliberately not drag-and-drop: you are standing in a garden with a phone,
 * and tapping a square is a great deal easier than dragging one.
 */
export function BedPlan({
	bed,
	href,
}: {
	bed: Bed;
	href?: (x: number, y: number) => string;
}) {
	const cells = [];
	for (let y = 0; y < bed.gridRows; y++) {
		for (let x = 0; x < bed.gridCols; x++) {
			cells.push({ x, y });
		}
	}

	// Anything sown without a spot still has to show up somewhere.
	const unplaced = bed.occupants.filter((o) => o.posX === null || o.posY === null);

	return (
		<div className="space-y-2">
			<div
				className="grid gap-1"
				style={{ gridTemplateColumns: `repeat(${bed.gridCols}, minmax(0, 1fr))` }}
			>
				{cells.map(({ x, y }) => {
					const occupant = bed.occupants.find((o) => o.posX === x && o.posY === y);
					const content = occupant ? (
						<>
							<span className="block truncate font-medium text-sm">
								{occupant.plantName}
							</span>
							{occupant.readyFrom && (
								<span className="block text-ink-soft text-xs">
									about {formatShort(occupant.readyFrom)}
								</span>
							)}
						</>
					) : (
						// An empty spot is an invitation, not a label. A grid full of
						// the word "empty" made the whole page look switched off.
						<span
							key={`${x}-${y}-empty`}
							aria-hidden="true"
							className="block text-center text-ink-faint text-lg leading-none opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
						>
							+
						</span>
					);

					const className = `group flex min-h-16 flex-col justify-center rounded-md border p-2 text-left ${
						occupant
							? 'border-fertilise bg-fertilise-soft'
							: 'border-rule border-dashed bg-paper-sunk hover:border-palace-300 hover:bg-palace-50'
					}`;

					const where = `column ${x + 1}, row ${y + 1}`;

					return href ? (
						<Link
							key={`${x}-${y}`}
							href={href(x, y)}
							aria-label={
								occupant ? `${occupant.plantName} in ${where}` : `Sow in ${where}`
							}
							className={className}
						>
							{content}
						</Link>
					) : (
						<div key={`${x}-${y}`} className={className}>
							{content}
							{!occupant && <span className="sr-only">Empty spot, {where}</span>}
						</div>
					);
				})}
			</div>

			{unplaced.length > 0 && (
				<p className="text-ink-soft text-xs">
					Also here, without a spot: {unplaced.map((o) => o.plantName).join(', ')}
				</p>
			)}
		</div>
	);
}
