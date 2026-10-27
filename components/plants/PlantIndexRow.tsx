import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { DataRow } from '@/components/ui/DataList';
import { ScientificName } from '@/components/ui/ScientificName';
import type { IndexRow } from '@/lib/db/queries/library';

/**
 * One plant in the Plants index or a search, from either side.
 *
 * The whole row is the plant's name and one line about it here; the badges
 * say the two facts that settle whether to open it standing in the garden -
 * whether it can be sown this month, and whether you grow it. It only ever
 * opens the article: adding happens there, so a slip of the thumb in a long
 * list adds nothing.
 */
export function PlantIndexRow({
	row,
	showYours = false,
}: {
	row: IndexRow;
	/** In a search, say which results are already the household's. */
	showYours?: boolean;
}) {
	return (
		// The name's link stretches over the whole row, so the target is the
		// row - two lines tall - and not one word of it.
		<DataRow className="relative hover:bg-palace-50">
			<span className="w-full min-w-0 space-y-0.5">
				<span className="flex flex-wrap items-baseline gap-x-2">
					<Link
						href={`/plants/${row.slug}`}
						className="font-medium after:absolute after:inset-0 after:content-['']"
					>
						{row.commonName}
					</Link>
					{row.kindOf ? (
						<span className="text-ink-soft text-xs">a kind of {row.kindOf}</span>
					) : (
						row.scientificName && (
							<ScientificName className="text-ink-soft text-sm">
								{row.scientificName}
							</ScientificName>
						)
					)}
					{row.kinds > 0 && (
						<span className="text-ink-soft text-xs">
							· {row.kinds} {row.kinds === 1 ? 'kind' : 'kinds'}
						</span>
					)}
				</span>
				<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
					{row.line && <span className="text-ink-soft text-xs">{row.line}</span>}
					{row.sowNow && (
						<Badge
							tone="good"
							title="This month is a sowing month in one of your places"
						>
							sow now
						</Badge>
					)}
					{row.growing !== null &&
						(showYours ? (
							<Badge>yours</Badge>
						) : row.growing > 0 ? (
							<Badge tone="good">{row.growing} growing</Badge>
						) : (
							<span className="text-ink-faint text-xs">none planted</span>
						))}
					{row.needsReview && row.growing !== null && !showYours && (
						<Badge
							tone="strong"
							title="figgy does not know this plant’s full schedule yet"
						>
							needs review
						</Badge>
					)}
				</span>
			</span>
		</DataRow>
	);
}
