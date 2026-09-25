/**
 * The shape a proposal has to arrive in.
 *
 * One schema, three jobs: it constrains what the model may return, it
 * validates what comes back, and it is what the review screen reads. Months
 * are plain numbers, 1 to 12, the same as everywhere else in figgy.
 */
import { z } from 'zod';

export const CONFIDENCE = ['high', 'medium', 'low'] as const;

export const proposedRuleSchema = z.object({
	action: z.enum([
		'fertilise',
		'prune',
		'harvest',
		'sow',
		'transplant',
		'thin',
		'net',
		'spray',
		'water',
	]),
	/** Months this applies to, 1 = January. Southern hemisphere. */
	months: z.array(z.number().int().min(1).max(12)).min(1).max(12),
	/**
	 * True when the months are a choice rather than a list: prune in August
	 * OR September, not both.
	 */
	alternatives: z.boolean(),
	cadence: z.enum(['monthly', 'once_in_window', 'continuous']),
	/** One short line a gardener would find useful. */
	note: z.string(),
	confidence: z.enum(CONFIDENCE),
	/** Why these months, in one sentence. */
	reasoning: z.string(),
	/** URLs this particular window came from. */
	sources: z.array(z.string()),
});

export const plantProposalSchema = z.object({
	commonName: z.string(),
	scientificName: z.string(),
	category: z.enum(['fruit_tree', 'vegetable', 'herb', 'other']),
	lifecycle: z.enum(['perennial', 'annual', 'biennial']),
	/** Botanical family, for crop rotation warnings. */
	family: z.string(),
	/** 0 when it does not apply, as for a perennial tree. */
	daysToMaturityMin: z.number().int().min(0),
	daysToMaturityMax: z.number().int().min(0),
	spacingCm: z.number().int().min(0),
	/** How the plant behaves here, in the gardener's terms. */
	notesMd: z.string(),
	/** Whether it will actually be happy in this climate, and why. */
	suitability: z.string(),
	rules: z.array(proposedRuleSchema),
	/** Anything the sources disagreed on, or that the model is unsure of. */
	caveats: z.array(z.string()),
});

export type ProposedRule = z.infer<typeof proposedRuleSchema>;
export type PlantProposal = z.infer<typeof plantProposalSchema>;

export type Citation = { url: string; title: string };

/** Confidence in the whole proposal: the weakest link in it. */
export function overallConfidence(
	proposal: PlantProposal,
): (typeof CONFIDENCE)[number] {
	if (proposal.rules.some((r) => r.confidence === 'low')) return 'low';
	if (proposal.rules.some((r) => r.confidence === 'medium')) return 'medium';
	return 'high';
}
