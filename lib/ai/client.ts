/**
 * Talking to Claude, on a household's own key.
 *
 * figgy has no key of its own to lend. A household admin adds theirs in
 * Settings, it is sealed in the database, and the whole household uses it;
 * until then every screen that would ask Claude says so and offers the manual
 * way, which works exactly as before. A missing key is a feature switched off,
 * not an app that is broken.
 */
import Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { open } from '@/lib/crypto/secretbox';
import { db } from '@/lib/db/client';
import { householdAiCredential } from '@/lib/db/schema';
import type { HouseholdId } from '@/lib/db/tenancy';

/** Opus, everywhere. Getting a plant's schedule wrong is expensive to unpick. */
export const MODEL = 'claude-opus-5';

/** What a sealed key is bound to. Copying it to another household breaks it. */
export function keyContext(hid: HouseholdId): string {
	return `household:${hid}`;
}

/**
 * A key for working on figgy itself, so a laptop does not need one saved in
 * its database. Never read in production, and deliberately not called
 * ANTHROPIC_API_KEY: the SDK reads that one on its own, and figgy must never
 * spend a key that nobody chose to give it.
 */
function developmentKey(): string | undefined {
	return process.env.NODE_ENV === 'production'
		? undefined
		: process.env.FIGGY_DEV_ANTHROPIC_API_KEY?.trim() || undefined;
}

export async function aiAvailable(hid: HouseholdId): Promise<boolean> {
	if (developmentKey()) return true;
	const row = await db
		.select({ id: householdAiCredential.householdId })
		.from(householdAiCredential)
		.where(eq(householdAiCredential.householdId, hid))
		.get();
	return row !== undefined;
}

export class NoKeyError extends Error {
	constructor() {
		super(
			'This household has not added an Anthropic key, so figgy cannot ask Claude.',
		);
	}
}

/** A client for one key. The key is always passed in: see developmentKey(). */
export function clientFor(apiKey: string, workspaceId?: string | null): Anthropic {
	return new Anthropic({
		apiKey,
		// Read from the environment otherwise, and sent alongside the key.
		authToken: null,
		maxRetries: 2,
		// An organisation-level key is not tied to a workspace and has to say
		// which one to bill; a workspace-scoped key already knows.
		defaultHeaders: workspaceId?.trim()
			? { 'anthropic-workspace-id': workspaceId.trim() }
			: undefined,
	});
}

/** A client on this household's key. A new one each time: no key is cached. */
export async function anthropicFor(hid: HouseholdId): Promise<Anthropic> {
	const row = await db
		.select()
		.from(householdAiCredential)
		.where(eq(householdAiCredential.householdId, hid))
		.get();
	if (row) return clientFor(open(row.keySealed, keyContext(hid)), row.workspaceId);
	const dev = developmentKey();
	if (dev) return clientFor(dev);
	throw new NoKeyError();
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
		return 'That API key was refused. A household admin can replace it in Settings.';
	}
	if (error instanceof Anthropic.PermissionDeniedError) {
		return 'That API key is not allowed to do this. Check its permissions in the Anthropic console.';
	}
	if (error instanceof Anthropic.RateLimitError) {
		return 'Claude is rate limiting us. Try again in a minute.';
	}
	if (error instanceof Anthropic.APIConnectionError) {
		return 'Could not reach Claude. Worth trying again in a minute.';
	}
	if (error instanceof Anthropic.APIError) {
		// The commonest first-run stumble, and the message tells you nothing
		// about where to go: the key is fine, the account is simply empty.
		if (/credit balance is too low/i.test(error.message)) {
			return 'The key works, but the Anthropic account has no credit. Add some under Plans & Billing at console.anthropic.com, then try again.';
		}
		if (/not scoped to a workspace/i.test(error.message)) {
			return 'That key belongs to the organisation rather than a workspace, so Claude does not know which workspace to bill. Either add the workspace ID next to the key in Settings, or make a workspace-scoped key in the Anthropic console.';
		}
		if (error.status >= 500) {
			return 'Claude had a problem at its end. Worth trying again shortly.';
		}
		return `Claude returned an error (${error.status}). ${plainMessage(error.message)}`;
	}
	if (error instanceof NoKeyError) return error.message;
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
