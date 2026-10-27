import { Badge } from '@/components/ui/Badge';
import { DataList, DataRow } from '@/components/ui/DataList';
import type { Decided } from '@/lib/db/queries/curator';

/** What was just decided, so the proof a tap landed outlives the row it was on. */
export function JustDecided({ decided }: { decided: Decided[] }) {
	if (decided.length === 0) return null;
	return (
		<div className="space-y-1">
			<h3 className="font-medium text-ink-soft text-sm">Just decided</h3>
			<DataList>
				{decided.map((d) => (
					<DataRow
						key={d.id}
						action={
							<Badge tone={d.outcome === 'accepted' ? 'good' : 'quiet'}>
								{d.outcome}
							</Badge>
						}
					>
						<span className="text-ink-soft">{d.what}</span>
					</DataRow>
				))}
			</DataList>
		</div>
	);
}
