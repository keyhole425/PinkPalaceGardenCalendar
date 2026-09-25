'use server';

/** Putting things in beds, and taking them out again. */
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { formatLong, isIsoDate, today } from '@/lib/dates';
import { db } from '@/lib/db/client';
import { rotationWarningFor } from '@/lib/db/queries/beds';
import { environment, planting, plantType } from '@/lib/db/schema';

export type ActionResult =
	| { ok: true; warning?: string }
	| { ok: false; error: string };

/** The rotation query may have no date at all to report. */
function describeWhen(value: string): string {
	return isIsoDate(value) ? `on ${formatLong(value)}` : value;
}

const sowSchema = z.object({
	environmentId: z.coerce.number().int().positive(),
	plantTypeId: z.coerce.number().int().positive(),
	label: z.string().trim().max(80).optional(),
	sownOn: z
		.string()
		.trim()
		.refine((v) => v === '' || isIsoDate(v), 'Give a date as YYYY-MM-DD')
		.optional(),
	posX: z.coerce.number().int().min(0).max(11).optional(),
	posY: z.coerce.number().int().min(0).max(11).optional(),
});

function refresh(slug?: string) {
	revalidatePath('/now');
	revalidatePath('/beds');
	revalidatePath('/grid');
	if (slug) revalidatePath(`/beds/${slug}`);
}

export async function sowInBed(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const parsed = sowSchema.safeParse({
		environmentId: form.get('environmentId'),
		plantTypeId: form.get('plantTypeId'),
		label: form.get('label') || undefined,
		sownOn: form.get('sownOn') ?? undefined,
		posX: form.get('posX') ?? undefined,
		posY: form.get('posY') ?? undefined,
	});
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? 'Check the form',
		};
	}

	const { environmentId, plantTypeId, posX, posY } = parsed.data;

	const plant = db
		.select()
		.from(plantType)
		.where(eq(plantType.id, plantTypeId))
		.get();
	if (!plant) return { ok: false, error: 'No such plant.' };

	const place = db
		.select({ slug: environment.slug })
		.from(environment)
		.where(eq(environment.id, environmentId))
		.get();
	if (!place) return { ok: false, error: 'No such bed.' };

	// Rotation is advice about soil, not a rule about data, so it never
	// refuses. The form says so before you press the button - which is the
	// moment it is useful - and the reply records that it was said.
	const rotation = rotationWarningFor(environmentId, plant.family);

	const sownOn = parsed.data.sownOn || today();

	db.insert(planting)
		.values({
			plantTypeId,
			environmentId,
			label: parsed.data.label || plant.commonName,
			sownOn,
			posX: posX ?? null,
			posY: posY ?? null,
			status: 'active',
		})
		.run();

	refresh(place.slug);
	return {
		ok: true,
		warning: rotation
			? `Sown. Worth remembering ${rotation.what} was here ${describeWhen(rotation.lastSeen)}.`
			: undefined,
	};
}

const clearSchema = z.object({
	plantingId: z.coerce.number().int().positive(),
	slug: z.string().optional(),
});

/** Pulled out, dug in, or finished. The record stays; the bed frees up. */
export async function clearFromBed(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const parsed = clearSchema.safeParse({
		plantingId: form.get('plantingId'),
		slug: form.get('slug') ?? undefined,
	});
	if (!parsed.success) return { ok: false, error: 'Nothing to clear.' };

	db.update(planting)
		.set({ status: 'removed', removedOn: today() })
		.where(eq(planting.id, parsed.data.plantingId))
		.run();

	refresh(parsed.data.slug);
	return { ok: true };
}
