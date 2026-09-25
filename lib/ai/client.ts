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

/**
 * Turns an SDK failure into something worth showing a gardener.
 *
 * The raw errors carry a JSON blob in `message`, which is no use to somebody
 * standing in a garden wondering why nothing happened. The cases worth
 * naming are the ones with something to do about them.
 */
export function describeError(error: unknown): string {
	if (error instanceof Anthropic.AuthenticationError) {
		return 'That API key was refused. Check ANTHROPIC_API_KEY in ops/.env.';
	}
	if (error instanceof Anthropic.PermissionDeniedError) {
		return 'That API key is not allowed to do this. Check its permissions in the Anthropic console.';
	}
	if (error instanceof Anthropic.RateLimitError) {
		return 'Claude is rate limiting us. Try again in a minute.';
	}
	if (error instanceof Anthropic.APIConnectionError) {
		return 'Could not reach Claude. Is this machine online?';
	}
	if (error instanceof Anthropic.APIError) {
		// The commonest first-run stumble, and the message tells you nothing
		// about where to go: the key is fine, the account is simply empty.
		if (/credit balance is too low/i.test(error.message)) {
			return 'The key works, but the Anthropic account has no credit. Add some under Plans & Billing at console.anthropic.com, then try again.';
		}
		if (error.status >= 500) {
			return 'Claude had a problem at its end. Worth trying again shortly.';
		}
		return `Claude returned an error (${error.status}). ${plainMessage(error.message)}`;
	}
	return error instanceof Error ? error.message : 'Something went wrong.';
}

/** Digs the human sentence out of an error body, when there is one. */
function plainMessage(raw: string): string {
	const match = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
	if (!match) return raw;
	try {
		return JSON.parse(`"${match[1]}"`);
	} catch {
		return match[1];
	}
}
