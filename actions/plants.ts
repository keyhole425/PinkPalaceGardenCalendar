'use server';

/** Adding and editing plants, the trees themselves, and where they grow. */
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireHousehold } from '@/lib/auth/context';
import { isIsoDate, today } from '@/lib/dates';
import { db } from '@/lib/db/client';
import {
	ENVIRONMENT_KINDS,
	environment,
	planting,
	plantType,
} from '@/lib/db/schema';
import { isOwned, ownedRow, owns } from '@/lib/db/tenancy';

export type ActionResult = { ok: true } | { ok: false; error: string };

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
}

function refresh(slug?: string) {
	revalidatePath('/now');
	revalidatePath('/grid');
	revalidatePath('/plants');
	if (slug) revalidatePath(`/plants/${slug}`);
}

const plantSchema = z.object({
	commonName: z.string().trim().min(1, 'Give it a name'),
	scientificName: z.string().trim().max(120).optional(),
	category: z.enum(['fruit_tree', 'vegetable', 'herb', 'other']),
	lifecycle: z.enum(['perennial', 'annual', 'biennial']),
	family: z.string().trim().max(60).optional(),
	notesMd: z.string().trim().max(5000).optional(),
});

export async function createPlantType(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const parsed = plantSchema.safeParse({
		commonName: form.get('commonName'),
		scientificName: form.get('scientificName') || undefined,
		category: form.get('category'),
		lifecycle: form.get('lifecycle'),
		family: form.get('family') || undefined,
		notesMd: form.get('notesMd') || undefined,
	});
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? 'Check the form',
		};
	}

	let slug = slugify(parsed.data.commonName);
	if (!slug) return { ok: false, error: 'That name has no letters in it.' };

	// Two mandarins would collide; give the second one a number.
	let attempt = 1;
	while (
		await db
			.select({ id: plantType.id })
			.from(plantType)
			.where(and(owns(plantType, householdId), eq(plantType.slug, slug)))
			.get()
	) {
		attempt++;
		slug = `${slugify(parsed.data.commonName)}-${attempt}`;
	}

	await db
		.insert(plantType)
		.values({
			householdId,
			slug,
			...parsed.data,
			source: 'user',
			// A plant with no rules yet is exactly what "needs review" means.
			needsReview: true,
			userModifiedAt: new Date().toISOString(),
		})
		.run();

	refresh(slug);
	redirect(`/plants/${slug}/edit`);
}

export async function updatePlantType(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const id = Number(form.get('plantTypeId'));
	if (!Number.isInteger(id) || id <= 0) {
		return { ok: false, error: 'No such plant.' };
	}
	const parsed = plantSchema.safeParse({
		commonName: form.get('commonName'),
		scientificName: form.get('scientificName') || undefined,
		category: form.get('category'),
		lifecycle: form.get('lifecycle'),
		family: form.get('family') || undefined,
		notesMd: form.get('notesMd') || undefined,
	});
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? 'Check the form',
		};
	}

	const row = await db
		.select({ slug: plantType.slug })
		.from(plantType)
		.where(ownedRow(plantType, id, householdId))
		.get();
	if (!row) return { ok: false, error: 'No such plant.' };

	await db
		.update(plantType)
		.set({
			...parsed.data,
			scientificName: parsed.data.scientificName ?? null,
			family: parsed.data.family ?? null,
			notesMd: parsed.data.notesMd ?? null,
			// From here on the seed keeps its hands off this plant's details.
			userModifiedAt: new Date().toISOString(),
		})
		.where(ownedRow(plantType, id, householdId))
		.run();

	refresh(row.slug);
	return { ok: true };
}

/** Clears the "figgy doesn't know this one properly" flag. */
export async function markReviewed(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const id = Number(form.get('plantTypeId'));
	if (!Number.isInteger(id) || id <= 0) {
		return { ok: false, error: 'No such plant.' };
	}
	const row = await db
		.select({ slug: plantType.slug })
		.from(plantType)
		.where(ownedRow(plantType, id, householdId))
		.get();
	if (!row) return { ok: false, error: 'No such plant.' };

	await db
		.update(plantType)
		.set({ needsReview: false, userModifiedAt: new Date().toISOString() })
		.where(ownedRow(plantType, id, householdId))
		.run();

	refresh(row.slug);
	return { ok: true };
}

const plantingSchema = z.object({
	plantTypeId: z.coerce.number().int().positive(),
	environmentId: z.coerce.number().int().positive(),
	label: z.string().trim().min(1, 'Give this one a name'),
	quantity: z.coerce.number().int().min(1).max(999).default(1),
	plantedOn: z
		.string()
		.trim()
		.refine((v) => v === '' || isIsoDate(v), 'Give a date as YYYY-MM-DD')
		.optional(),
	notesMd: z.string().trim().max(2000).optional(),
});

export async function createPlanting(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const parsed = plantingSchema.safeParse({
		plantTypeId: form.get('plantTypeId'),
		environmentId: form.get('environmentId'),
		label: form.get('label'),
		quantity: form.get('quantity') || 1,
		plantedOn: form.get('plantedOn') ?? undefined,
		notesMd: form.get('notesMd') || undefined,
	});
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? 'Check the form',
		};
	}

	const plant = await db
		.select({ slug: plantType.slug })
		.from(plantType)
		.where(ownedRow(plantType, parsed.data.plantTypeId, householdId))
		.get();
	if (!plant) return { ok: false, error: 'No such plant.' };
	if (!(await isOwned(environment, parsed.data.environmentId, householdId))) {
		return { ok: false, error: 'No such place.' };
	}

	const clash = await db
		.select({ id: planting.id })
		.from(planting)
		.where(
			and(
				owns(planting, householdId),
				eq(planting.plantTypeId, parsed.data.plantTypeId),
				eq(planting.label, parsed.data.label),
			),
		)
		.get();
	if (clash) {
		return { ok: false, error: 'There is already one by that name.' };
	}

	await db
		.insert(planting)
		.values({
			householdId,
			plantTypeId: parsed.data.plantTypeId,
			environmentId: parsed.data.environmentId,
			label: parsed.data.label,
			quantity: parsed.data.quantity,
			plantedOn: parsed.data.plantedOn || null,
			notesMd: parsed.data.notesMd || null,
			status: 'active',
		})
		.run();

	refresh(plant.slug);
	return { ok: true };
}

const retireSchema = z.object({
	plantingId: z.coerce.number().int().positive(),
	status: z.enum(['active', 'removed', 'dead']),
	slug: z.string().optional(),
});

/**
 * A tree that has gone stops asking to be pruned, but its history stays: what
 * it gave you over the years is worth keeping.
 */
export async function setPlantingStatus(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const parsed = retireSchema.safeParse({
		plantingId: form.get('plantingId'),
		status: form.get('status'),
		slug: form.get('slug') ?? undefined,
	});
	if (!parsed.success) return { ok: false, error: 'Nothing to change.' };

	await db
		.update(planting)
		.set({
			status: parsed.data.status,
			removedOn:
				parsed.data.status === 'active'
					? null
					: // The garden's date, not UTC's: before 9:30 in the morning in
						// Adelaide, UTC is still on yesterday.
						today(),
		})
		.where(ownedRow(planting, parsed.data.plantingId, householdId))
		.run();

	refresh(parsed.data.slug);
	return { ok: true };
}

const environmentSchema = z.object({
	name: z.string().trim().min(1, 'Give it a name'),
	kind: z.enum(ENVIRONMENT_KINDS),
	frostFree: z.boolean().default(false),
	windowShiftMonths: z.coerce.number().int().min(-6).max(6).default(0),
	notes: z.string().trim().max(2000).optional(),
});

export async function createEnvironment(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const parsed = environmentSchema.safeParse({
		name: form.get('name'),
		kind: form.get('kind'),
		frostFree: form.get('frostFree') === 'on',
		windowShiftMonths: form.get('windowShiftMonths') || 0,
		notes: form.get('notes') || undefined,
	});
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? 'Check the form',
		};
	}

	let slug = slugify(parsed.data.name);
	if (!slug) return { ok: false, error: 'That name has no letters in it.' };
	let attempt = 1;
	while (
		await db
			.select({ id: environment.id })
			.from(environment)
			.where(and(owns(environment, householdId), eq(environment.slug, slug)))
			.get()
	) {
		attempt++;
		slug = `${slugify(parsed.data.name)}-${attempt}`;
	}

	await db
		.insert(environment)
		.values({ householdId, slug, ...parsed.data })
		.run();
	revalidatePath('/environments');
	refresh();
	return { ok: true };
}
