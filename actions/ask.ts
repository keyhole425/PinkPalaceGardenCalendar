'use server';

import { revalidatePath } from 'next/cache';
import { askGarden } from '@/lib/ai/ask';
import { aiAvailable, describeError } from '@/lib/ai/client';
import { requireHousehold } from '@/lib/auth/context';

export type AskResult =
	| { ok: true; question: string; answer: string; toolsUsed: string[] }
	| { ok: false; error: string };

export async function ask(
	_previous: AskResult | null,
	form: FormData,
): Promise<AskResult> {
	const { householdId } = await requireHousehold();
	if (!(await aiAvailable(householdId))) {
		return {
			ok: false,
			error:
				'This household has no Anthropic key yet, so there is nobody to ask. An admin can add one in Settings.',
		};
	}

	const question = (form.get('question') ?? '').toString().trim();
	if (question.length < 3) return { ok: false, error: 'Ask something.' };
	if (question.length > 500) {
		return { ok: false, error: 'Shorter questions get better answers.' };
	}

	try {
		const result = await askGarden(householdId, question);
		revalidatePath('/settings');
		return { ok: true, question, ...result };
	} catch (error) {
		return { ok: false, error: describeError(error) };
	}
}
