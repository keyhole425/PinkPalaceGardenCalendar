/** What each request cost, written down so spending is visible. */
import { db } from '@/lib/db/client';
import { aiCall } from '@/lib/db/schema';
import { MODEL } from './client';

/** Anthropic's published rates for Opus 5, in US dollars per million tokens. */
const RATES = {
	input: 5,
	output: 25,
	// Cached input reads at a tenth; writing to the cache costs a quarter more.
	cacheRead: 0.5,
	cacheWrite: 6.25,
} as const;

export type Usage = {
	input_tokens?: number;
	output_tokens?: number;
	cache_read_input_tokens?: number | null;
	cache_creation_input_tokens?: number | null;
};

export function costInCents(usage: Usage): number {
	const perMillion =
		(usage.input_tokens ?? 0) * RATES.input +
		(usage.output_tokens ?? 0) * RATES.output +
		(usage.cache_read_input_tokens ?? 0) * RATES.cacheRead +
		(usage.cache_creation_input_tokens ?? 0) * RATES.cacheWrite;
	return (perMillion / 1_000_000) * 100;
}

export function recordCall(args: {
	proposalId?: number;
	purpose: string;
	usage: Usage;
	webSearches?: number;
}) {
	db.insert(aiCall)
		.values({
			proposalId: args.proposalId ?? null,
			purpose: args.purpose,
			model: MODEL,
			inputTokens: args.usage.input_tokens ?? 0,
			outputTokens: args.usage.output_tokens ?? 0,
			cacheReadTokens: args.usage.cache_read_input_tokens ?? 0,
			cacheWriteTokens: args.usage.cache_creation_input_tokens ?? 0,
			webSearches: args.webSearches ?? 0,
			costCents: costInCents(args.usage),
		})
		.run();
}
