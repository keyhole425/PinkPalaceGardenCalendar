/**
 * What gardens offer the library, for a site admin to accept or turn down.
 *
 * Four kinds, all made as a side effect of what someone was doing anyway,
 * except a note:
 *  - rule_change: someone here changed a library plant's months.
 *  - research: Claude looked up a library plant for a garden, and it was
 *    accepted.
 *  - new_plant: a garden has a plant the library doesn't - added by hand or
 *    from a look-up.
 *  - note: "Suggest something" on an article, in the person's own words.
 *
 * Only from a garden that shares what it grows, and anonymous the same way
 * evidence is (lib/library/evidence.ts): keyed hashes for the garden and the
 * plant, and names taken out of anything typed.
 *
 * Every suggestion has a slot - this garden, this plant, this action - and a
 * fingerprint of what it says. A new one in the same slot replaces the open
 * one; one the curator has already turned down is not made again.
 */
import { createHash } from 'node:crypto';
import { and, asc, eq, isNull, like } from 'drizzle-orm';
import type { Citation, PlantProposal } from '@/lib/ai/schema';
import { db } from '@/lib/db/client';
import {
	aiProposal,
	careRule,
	household,
	librarySuggestion,
	plantType,
	type RegionId,
	type SuggestionKind,
} from '@/lib/db/schema';
import { type HouseholdId, ownedRow, owns } from '@/lib/db/tenancy';
import { maskFromMonths, monthsFromMask } from '@/lib/schedule/months';
import type { RuleLike } from './describe';
import { afterResponse, gardenKey, redact, subjectKey } from './evidence';

/** One action's months as a suggestion carries them: a list per alternative. */
export type SuggestedRule = {
	action: string;
	/** More than one list means a choice: "Aug or Sep". */
	months: number[][];
	environmentKind: string | null;
};

export type RuleChangePayload = { rule: SuggestedRule; removed: boolean };
export type ResearchPayload = {
	rules: SuggestedRule[];
	suitability: string;
	notesMd: string;
	citations: Citation[];
};
export type NewPlantPayload = {
	commonName: string;
	scientificName: string | null;
	category: 'fruit_tree' | 'vegetable' | 'herb' | 'other';
	lifecycle: 'perennial' | 'annual' | 'biennial';
	family: string | null;
	daysToMaturityMin: number | null;
	daysToMaturityMax: number | null;
	spacingCm: number | null;
	notesMd: string | null;
	rules: SuggestedRule[];
	citations: Citation[];
};
export type NotePayload = { text: string };

function fingerprint(payload: unknown): string {
	return createHash('sha256')
		.update(JSON.stringify(payload))
		.digest('base64url')
		.slice(0, 16);
}

async function sharer(hid: HouseholdId): Promise<{ region: RegionId } | null> {
	const row = await db
		.select({ share: household.shareGrowing, region: household.region })
		.from(household)
		.where(eq(household.id, hid))
		.get();
	return row?.share ? { region: row.region } : null;
}

/**
 * Files one suggestion. `slot` names what it is about, without naming the
 * garden: the garden's key is added here.
 */
async function file(
	hid: HouseholdId,
	region: RegionId,
	kind: SuggestionKind,
	slot: string,
	payload: unknown,
	refs: { libraryPlantId?: number | null; subjectKey?: string | null } = {},
): Promise<void> {
	const garden = gardenKey(hid);
	const prefix = `${kind}:${garden}:${slot}#`;
	const sourceKey = `${prefix}${fingerprint(payload)}`;

	const same = await db
		.select({ status: librarySuggestion.status })
		.from(librarySuggestion)
		.where(eq(librarySuggestion.sourceKey, sourceKey))
		.get();
	// Already open, or already decided: nothing to file.
	if (same) return;

	await db
		.delete(librarySuggestion)
		.where(
			and(
				like(librarySuggestion.sourceKey, `${prefix}%`),
				eq(librarySuggestion.status, 'open'),
			),
		)
		.run();
	await db
		.insert(librarySuggestion)
		.values({
			kind,
			libraryPlantId: refs.libraryPlantId ?? null,
			region,
			gardenKey: garden,
			subjectKey: refs.subjectKey ?? null,
			sourceKey,
			payload: JSON.stringify(payload),
		})
		.run();
}

/** A plant's rules for one action, or every action, as a suggestion carries them. */
async function rulesOf(
	hid: HouseholdId,
	plantTypeId: number,
	action?: string,
): Promise<SuggestedRule[]> {
	const rows = await db
		.select()
		.from(careRule)
		.where(
			and(
				owns(careRule, hid),
				eq(careRule.plantTypeId, plantTypeId),
				isNull(careRule.plantingId),
				eq(careRule.active, true),
			),
		)
		.orderBy(asc(careRule.id))
		.all();
	const groups = new Map<string, typeof rows>();
	for (const row of rows) {
		if (action && row.action !== action) continue;
		const key = `${row.action}:${row.environmentKind ?? ''}`;
		groups.set(key, [...(groups.get(key) ?? []), row]);
	}
	return [...groups.values()].map((members) => {
		const alternatives =
			members.some((m) => m.altGroup !== null) && members.length > 1;
		const months = alternatives
			? members.map((m) => monthsFromMask(m.monthMask))
			: [monthsFromMask(members.reduce((mask, m) => mask | m.monthMask, 0))];
		return {
			action: members[0].action,
			months,
			environmentKind: members[0].environmentKind,
		};
	});
}

/**
 * After someone here changes one of a plant's rules: a library plant's new
 * months are a rule_change; a plant of the garden's own is a new plant whose
 * rules just changed.
 */
export async function ruleChanged(
	hid: HouseholdId,
	plantTypeId: number,
	action: string,
): Promise<void> {
	const here = await sharer(hid);
	if (!here) return;
	const plant = await db
		.select({ libraryPlantId: plantType.libraryPlantId })
		.from(plantType)
		.where(ownedRow(plantType, plantTypeId, hid))
		.get();
	if (!plant) return;
	if (plant.libraryPlantId === null) {
		await plantOfItsOwn(hid, plantTypeId);
		return;
	}
	const [rule] = await rulesOf(hid, plantTypeId, action);
	const payload: RuleChangePayload = rule
		? { rule, removed: false }
		: { rule: { action, months: [], environmentKind: null }, removed: true };
	await file(
		hid,
		here.region,
		'rule_change',
		`${plant.libraryPlantId}:${action}`,
		payload,
		{
			libraryPlantId: plant.libraryPlantId,
		},
	);
}

/**
 * A plant the library doesn't have: what it is and what it needs, offered as
 * a new plant. Kept up to date as the garden fills its rules in.
 */
export async function plantOfItsOwn(
	hid: HouseholdId,
	plantTypeId: number,
): Promise<void> {
	const here = await sharer(hid);
	if (!here) return;
	const plant = await db
		.select()
		.from(plantType)
		.where(ownedRow(plantType, plantTypeId, hid))
		.get();
	if (!plant || plant.libraryPlantId !== null) return;

	const proposal = await db
		.select({ citations: aiProposal.citations })
		.from(aiProposal)
		.where(
			and(
				owns(aiProposal, hid),
				eq(aiProposal.plantTypeId, plantTypeId),
				eq(aiProposal.status, 'accepted'),
			),
		)
		.get();
	const payload: NewPlantPayload = {
		commonName: plant.commonName,
		scientificName: plant.scientificName,
		category: plant.category,
		lifecycle: plant.lifecycle,
		family: plant.family,
		daysToMaturityMin: plant.daysToMaturityMin,
		daysToMaturityMax: plant.daysToMaturityMax,
		spacingCm: plant.spacingCm,
		notesMd: plant.notesMd ? redact(plant.notesMd, [plant.slug]) : null,
		rules: await rulesOf(hid, plantTypeId),
		citations: proposal?.citations ? JSON.parse(proposal.citations) : [],
	};
	const subject = subjectKey(plantTypeId);
	await file(hid, here.region, 'new_plant', subject, payload, {
		subjectKey: subject,
	});
}

/** An accepted look-up of a library plant: Claude's months and its sources. */
export async function researched(
	hid: HouseholdId,
	plantTypeId: number,
	proposal: PlantProposal,
	accepted: number[],
	citations: Citation[],
): Promise<void> {
	const here = await sharer(hid);
	if (!here) return;
	const plant = await db
		.select({ libraryPlantId: plantType.libraryPlantId })
		.from(plantType)
		.where(ownedRow(plantType, plantTypeId, hid))
		.get();
	if (!plant) return;
	if (plant.libraryPlantId === null) {
		await plantOfItsOwn(hid, plantTypeId);
		return;
	}
	const payload: ResearchPayload = {
		rules: proposal.rules
			.filter((_, i) => accepted.includes(i))
			.map((r) => ({
				action: r.action,
				months: r.alternatives ? r.months.map((m) => [m]) : [r.months],
				environmentKind: null,
			})),
		suitability: proposal.suitability,
		notesMd: proposal.notesMd,
		citations,
	};
	await file(hid, here.region, 'research', `${plant.libraryPlantId}`, payload, {
		libraryPlantId: plant.libraryPlantId,
	});
}

/**
 * "Suggest something", from an article. Filed whether or not the garden
 * shares what it grows: someone pressed a button to send it.
 */
export async function noteFor(
	hid: HouseholdId,
	libraryPlantId: number,
	region: RegionId,
	text: string,
	names: string[],
): Promise<void> {
	const payload: NotePayload = { text: redact(text, names) };
	await file(hid, region, 'note', `${libraryPlantId}:${Date.now()}`, payload, {
		libraryPlantId,
	});
}

/** These, after the response, from the actions. */
export const ruleChangedLater = (
	hid: HouseholdId,
	plantTypeId: number,
	action: string,
) => afterResponse(() => ruleChanged(hid, plantTypeId, action));
export const plantOfItsOwnLater = (hid: HouseholdId, plantTypeId: number) =>
	afterResponse(() => plantOfItsOwn(hid, plantTypeId));

/** A suggestion's months as rules, for the lines and strips that draw them. */
export function asRules(rules: SuggestedRule[]): RuleLike[] {
	return rules.flatMap((rule) =>
		rule.months.map((months) => ({
			action: rule.action,
			monthMask: maskFromMonths(months),
			altGroup: rule.months.length > 1 ? `suggested:${rule.action}` : null,
			environmentKind: rule.environmentKind,
		})),
	);
}
