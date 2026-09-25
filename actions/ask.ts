'use server';

import { revalidatePath } from 'next/cache';
import { askGarden } from '@/lib/ai/ask';
import { aiAvailable, describeError } from '@/lib/ai/client';

export type AskResult =
	| { ok: true; question: string; answer: string; toolsUsed: string[] }
	| { ok: false; error: string };

export async function ask(
	_previous: AskResult | null,
	form: FormData,
): Promise<AskResult> {
	if (!aiAvailable()) {
		return {
			ok: false,
			error:
				'figgy has no API key, so there is nobody to ask. Add ANTHROPIC_API_KEY and restart.',
		};
	}

	const question = (form.get('question') ?? '').toString().trim();
	if (question.length < 3) return { ok: false, error: 'Ask something.' };
	if (question.length > 500) {
		return { ok: false, error: 'Shorter questions get better answers.' };
	}

	try {
		const result = await askGarden(question);
		revalidatePath('/settings');
		return { ok: true, question, ...result };
	} catch (error) {
		return { ok: false, error: describeError(error) };
	}
}
