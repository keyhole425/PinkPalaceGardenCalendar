/**
 * When what gardens found disagrees with what the library says.
 *
 * Plain rules, worked out here rather than asked of a model - like the
 * weather's frost and heat, a disagreement is arithmetic, and an answer that
 * costs nothing and works offline beats a clever one. Each flag is a
 * sentence for the curator, never a change: deciding is theirs.
 *
 * Only open-ground grows count against the months: a hothouse runs ahead of
 * the library's windows, and evidence doesn't say by how much.
 */
import { hasMonth, type Month, monthAbbr } from '@/lib/schedule/months';
import type { RuleLike } from './describe';

export type EvidenceLike = {
	environmentKind: string;
	sowMonth: number | null;
	daysToFirstHarvest: number | null;
	outcome: string;
};

/** Two of something is a pattern worth a look; one is a garden. */
const ENOUGH = 2;

function median(values: number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2
		? sorted[mid]
		: Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function flagsFor(
	rules: RuleLike[],
	daysMin: number | null,
	daysMax: number | null,
	evidence: EvidenceLike[],
): string[] {
	const flags: string[] = [];
	const open = evidence.filter((e) => e.environmentKind !== 'hothouse');
	const sowMask = rules
		.filter((r) => r.action === 'sow' && r.environmentKind === null)
		.reduce((mask, r) => mask | r.monthMask, 0);

	if (sowMask !== 0) {
		// Picked, from a month the library says not to sow in.
		const outside = new Map<number, number>();
		for (const e of open) {
			if (e.outcome !== 'harvested' || e.sowMonth === null) continue;
			if (hasMonth(sowMask, e.sowMonth as Month)) continue;
			outside.set(e.sowMonth, (outside.get(e.sowMonth) ?? 0) + 1);
		}
		for (const [month, n] of outside) {
			if (n >= ENOUGH) {
				flags.push(
					`${n} sown in ${monthAbbr(month as Month)}, outside the sowing months, were picked.`,
				);
			}
		}
	}

	// A month that keeps failing, with nothing picked from it.
	const byMonth = new Map<number, { lost: number; picked: number }>();
	for (const e of open) {
		if (e.sowMonth === null) continue;
		const tally = byMonth.get(e.sowMonth) ?? { lost: 0, picked: 0 };
		if (e.outcome === 'died' || e.outcome === 'pulled') tally.lost++;
		if (e.outcome === 'harvested') tally.picked++;
		byMonth.set(e.sowMonth, tally);
	}
	for (const [month, tally] of byMonth) {
		if (tally.lost >= ENOUGH && tally.picked === 0) {
			flags.push(
				`${tally.lost} sown in ${monthAbbr(month as Month)} died or were pulled, and none were picked.`,
			);
		}
	}

	// Picking a good deal sooner or later than the library says.
	const days = evidence
		.map((e) => e.daysToFirstHarvest)
		.filter((d): d is number => d !== null);
	const typical = days.length >= ENOUGH ? median(days) : null;
	if (typical !== null && daysMin) {
		const max = daysMax ?? daysMin;
		if (typical < daysMin * 0.8 || typical > max * 1.25) {
			flags.push(
				`First picked after ${typical} days, typically; the library says ${daysMin === max ? daysMin : `${daysMin}–${max}`}.`,
			);
		}
	}
	return flags;
}

export { median };
