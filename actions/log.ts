'use server';

/**
 * Saying what you did, in a sentence.
 *
 * Parsing proposes; committing writes. They are separate actions with a
 * confirmation sheet between them, because a misheard sentence that silently
 * becomes six records is much worse than one you glance at first.
 *
 * Committing reuses the schedule: if a job of that kind is open for that plant
 * on that date, the entry answers it and ticks it off. Otherwise it goes in as
 * an ad-hoc record, which is exactly what "picked a few figs" is.
 */
import { and, asc, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { aiAvailable, describeError } from '@/lib/ai/client';
import {
	type KnownPlanting,
	type ParsedLog,
	parseLogSentence,
} from '@/lib/ai/parse-log';
import { type IsoDate, isIsoDate, today, yearOf } from '@/lib/dates';
import { db } from '@/lib/db/client';
import { getSchedule, OVERDUE_LOOKBACK_DAYS } from '@/lib/db/queries/garden';
import {
	CARE_ACTIONS,
	careLog,
	environment,
	planting,
	plantType,
} from '@/lib/db/schema';

export type ParseResult =
	| { ok: true; parsed: ParsedLog; sentence: string }
	| { ok: false; error: string };

export type CommitResult =
	| { ok: true; written: number }
	| { ok: false; error: string };

export async function knownPlantings(): Promise<KnownPlanting[]> {
	return db
		.select({
			id: planting.id,
			label: planting.label,
			plantName: plantType.commonName,
			place: environment.name,
		})
		.from(planting)
		.innerJoin(plantType, eq(planting.plantTypeId, plantType.id))
		.innerJoin(environment, eq(planting.environmentId, environment.id))
		.where(ne(planting.status, 'removed'))
		.orderBy(asc(planting.label))
		.all();
}

export async function parseLog(
	_previous: ParseResult | null,
	form: FormData,
): Promise<ParseResult> {
	if (!aiAvailable()) {
		return {
			ok: false,
			error:
				'figgy has no API key, so it cannot read a sentence. Add ANTHROPIC_API_KEY and restart.',
		};
	}

	const sentence = (form.get('sentence') ?? '').toString().trim();
	if (sentence.length < 3) {
		return { ok: false, error: 'Say what you did.' };
	}
	if (sentence.length > 1000) {
		return { ok: false, error: 'That is a long afternoon. Try it in parts.' };
	}

	try {
		const parsed = await parseLogSentence(sentence, await knownPlantings());
		if (parsed.entries.length === 0) {
			return {
				ok: false,
				error:
					parsed.unclear[0] ??
					'Nothing in that looked like something you did to a plant.',
			};
		}
		revalidatePath('/settings');
		return { ok: true, parsed, sentence };
	} catch (error) {
		return { ok: false, error: describeError(error) };
	}
}

const commitSchema = z.object({
	entries: z
		.array(
			z.object({
				plantingId: z.coerce.number().int().positive(),
				action: z.enum(CARE_ACTIONS),
				completedOn: z.string().refine(isIsoDate, 'Give a date as YYYY-MM-DD'),
				quantity: z.string().max(200).optional(),
				note: z.string().max(2000).optional(),
			}),
		)
		.min(1),
});

/**
 * Does an open job of this kind exist for this plant around this date? If so
 * the entry answers it; a tick, not a second record beside it.
 *
 * Two ways it can match, and the second one matters more than it looks.
 * Inside the window is the easy case. But a window that closed last month with
 * nothing logged against it is exactly the job you are most likely to be
 * describing - you are writing it down late because you did it late - so a
 * recently missed job of the same kind counts too. Without that, "pruned the
 * mulberry on Tuesday" filed a new record beside the overdue August pruning
 * and left it sitting there overdue, which is not what anybody meant.
 *
 * The lookback is the same ninety days the dashboard uses, so a sentence can
 * only answer a job the dashboard would still be nagging about.
 */
function matchOccurrence(
	plantingId: number,
	action: string,
	on: IsoDate,
): { key: string; ruleId: number; seasonYear: number } | null {
	const entry = getSchedule(on).plantings.find(
		(p) => p.context.plantingId === plantingId,
	);
	if (!entry) return null;

	const open = entry.occurrences.filter(
		(o) => o.rule.action === action && o.state !== 'done',
	);

	const inWindow = open.find((o) => o.opensOn <= on && o.closesOn >= on);
	const recentlyMissed = open
		.filter(
			(o) => o.closesOn < on && o.closesOn >= shiftIso(on, -OVERDUE_LOOKBACK_DAYS),
		)
		// The most recently closed one: last August's pruning, not the one before.
		.sort((a, b) => b.closesOn.localeCompare(a.closesOn))[0];

	const candidate = inWindow ?? recentlyMissed;
	return candidate
		? {
				key: candidate.key,
				ruleId: candidate.rule.id,
				seasonYear: candidate.seasonYear,
			}
		: null;
}

function shiftIso(date: IsoDate, days: number): IsoDate {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

export async function commitLog(
	_previous: CommitResult | null,
	form: FormData,
): Promise<CommitResult> {
	const raw = form.get('entries')?.toString() ?? '[]';
	let parsed: z.infer<typeof commitSchema>;
	try {
		parsed = commitSchema.parse({ entries: JSON.parse(raw) });
	} catch {
		return { ok: false, error: 'Nothing to record.' };
	}

	let written = 0;
	for (const entry of parsed.entries) {
		const exists = db
			.select({ id: planting.id })
			.from(planting)
			.where(eq(planting.id, entry.plantingId))
			.get();
		if (!exists) continue;

		const match = matchOccurrence(
			entry.plantingId,
			entry.action,
			entry.completedOn,
		);

		// You do not prune the same tree twice in one day, so a second identical
		// entry is a double submission rather than a second pruning. Picking is
		// the exception: two kilos this morning and one more this afternoon are
		// genuinely two pickings, and the whole point of an ad-hoc record.
		if (entry.action !== 'harvest') {
			const already = db
				.select({ id: careLog.id })
				.from(careLog)
				.where(
					and(
						eq(careLog.plantingId, entry.plantingId),
						eq(careLog.action, entry.action),
						eq(careLog.completedOn, entry.completedOn),
					),
				)
				.get();
			if (already) continue;
		}

		try {
			db.insert(careLog)
				.values({
					plantingId: entry.plantingId,
					careRuleId: match?.ruleId ?? null,
					action: entry.action,
					seasonYear: match?.seasonYear ?? yearOf(entry.completedOn),
					occurrenceKey: match?.key ?? null,
					completedOn: entry.completedOn,
					quantityNote: entry.quantity || null,
					notesMd: entry.note || null,
				})
				.run();
			written++;
		} catch (error) {
			// Already ticked off. Not worth stopping the rest of the sentence for.
			if (!String(error).includes('UNIQUE')) throw error;
		}
	}

	revalidatePath('/now');
	revalidatePath('/grid');
	revalidatePath('/plants');
	return { ok: true, written };
}

/** Used by the sheet to show what a proposed entry will attach to. */
export async function describePlanting(id: number): Promise<string | null> {
	const row = db
		.select({ label: planting.label })
		.from(planting)
		.where(and(eq(planting.id, id), ne(planting.status, 'removed')))
		.get();
	return row?.label ?? null;
}

export { today };
