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
import { getSchedule } from '@/lib/db/queries/garden';
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

	const candidate = entry.occurrences.find(
		(o) =>
			o.rule.action === action &&
			o.state !== 'done' &&
			o.opensOn <= on &&
			o.closesOn >= on,
	);
	return candidate
		? {
				key: candidate.key,
				ruleId: candidate.rule.id,
				seasonYear: candidate.seasonYear,
			}
		: null;
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
