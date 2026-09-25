/**
 * Talking to Claude.
 *
 * figgy works perfectly well without this. Every screen that uses it checks
 * `aiAvailable()` first and falls back to the manual path, so a missing key
 * is a feature that is switched off rather than an app that is broken.
 */
import Anthropic from '@anthropic-ai/sdk';

/** Opus, everywhere. Getting a plant's schedule wrong is expensive to unpick. */
export const MODEL = 'claude-opus-5';

export function aiAvailable(): boolean {
	return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
	if (!aiAvailable()) {
		throw new Error(
			'No ANTHROPIC_API_KEY, so figgy cannot look anything up. Add one and restart.',
		);
	}
	client ??= new Anthropic();
	return client;
}

/** Turns an SDK failure into something worth showing a gardener. */
export function describeError(error: unknown): string {
	if (error instanceof Anthropic.AuthenticationError) {
		return 'That API key was refused. Check ANTHROPIC_API_KEY.';
	}
	if (error instanceof Anthropic.RateLimitError) {
		return 'Claude is rate limiting us. Try again in a minute.';
	}
	if (error instanceof Anthropic.APIConnectionError) {
		return 'Could not reach Claude. Is this machine online?';
	}
	if (error instanceof Anthropic.APIError) {
		return `Claude returned an error (${error.status}). ${error.message}`;
	}
	return error instanceof Error ? error.message : 'Something went wrong.';
}
