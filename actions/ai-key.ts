'use server';

/**
 * A household's Anthropic key: adding it, checking it, taking it away.
 *
 * Household admins only. The key goes in through a form and never comes
 * back out - not to the page, not to a log, not in an error. What the page
 * can know is that there is one, its last four characters, and whether it
 * worked the last time anybody checked.
 */
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
	anthropicFor,
	clientFor,
	describeError,
	keyContext,
} from '@/lib/ai/client';
import { requireHousehold } from '@/lib/auth/context';
import { seal } from '@/lib/crypto/secretbox';
import { db } from '@/lib/db/client';
import { householdAiCredential } from '@/lib/db/schema';

export type KeyResult =
	| { ok: true; message: string }
	| { ok: false; error: string };

const NOT_ADMIN: KeyResult = {
	ok: false,
	error: 'Only an admin of this household can change its key.',
};

const keySchema = z.object({
	apiKey: z
		.string()
		.trim()
		.startsWith('sk-ant-', 'Anthropic keys start with sk-ant-.')
		.max(300, 'That is longer than any Anthropic key.'),
	workspaceId: z.string().trim().max(100).optional(),
});

function refresh() {
	revalidatePath('/', 'layout');
}

/**
 * Asks Anthropic which models the key can see. It costs nothing and proves
 * the key works - and, for an organisation key, that the workspace is right.
 */
async function check(client: ReturnType<typeof clientFor>): Promise<string | null> {
	try {
		await client.models.list({ limit: 1 });
		return null;
	} catch (error) {
		return describeError(error);
	}
}

export async function saveAiKey(
	_previous: KeyResult | null,
	form: FormData,
): Promise<KeyResult> {
	const ctx = await requireHousehold();
	if (ctx.role !== 'admin') return NOT_ADMIN;
	const parsed = keySchema.safeParse({
		apiKey: form.get('apiKey'),
		workspaceId: form.get('workspaceId') || undefined,
	});
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? 'Check the key.',
		};
	}
	const { apiKey, workspaceId } = parsed.data;

	const problem = await check(clientFor(apiKey, workspaceId));
	if (problem) return { ok: false, error: `Not saved. ${problem}` };

	const now = new Date().toISOString();
	const row = {
		keySealed: seal(apiKey, keyContext(ctx.householdId)),
		keyLast4: apiKey.slice(-4),
		workspaceId: workspaceId || null,
		updatedAt: now,
		updatedByUserId: ctx.userId,
		checkedAt: now,
		checkOk: true,
	};
	await db
		.insert(householdAiCredential)
		.values({ householdId: ctx.householdId, ...row })
		.onConflictDoUpdate({ target: householdAiCredential.householdId, set: row })
		.run();

	refresh();
	return { ok: true, message: 'Saved, and it works. Looking things up is on.' };
}

export async function checkAiKey(
	_previous: KeyResult | null,
	_form: FormData,
): Promise<KeyResult> {
	const ctx = await requireHousehold();
	if (ctx.role !== 'admin') return NOT_ADMIN;

	let problem: string | null;
	try {
		problem = await check(await anthropicFor(ctx.householdId));
	} catch (error) {
		problem = describeError(error);
	}
	await db
		.update(householdAiCredential)
		.set({ checkedAt: new Date().toISOString(), checkOk: problem === null })
		.where(eq(householdAiCredential.householdId, ctx.householdId))
		.run();

	refresh();
	return problem
		? { ok: false, error: problem }
		: { ok: true, message: 'It works.' };
}

export async function removeAiKey(
	_previous: KeyResult | null,
	_form: FormData,
): Promise<KeyResult> {
	const ctx = await requireHousehold();
	if (ctx.role !== 'admin') return NOT_ADMIN;

	await db
		.delete(householdAiCredential)
		.where(eq(householdAiCredential.householdId, ctx.householdId))
		.run();

	refresh();
	return {
		ok: true,
		message: 'Removed. Looking things up is off until a key is added.',
	};
}
