'use server';

/**
 * Adding and editing plants, and the trees themselves. Places - where they
 * grow - are in `actions/places.ts`.
 */
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireHousehold } from '@/lib/auth/context';
import { isIsoDate, today } from '@/lib/dates';
import { db } from '@/lib/db/client';
import { currentPlaces } from '@/lib/db/queries/beds';
import { householdRegion } from '@/lib/db/queries/household';
import { environment, planting, plantType } from '@/lib/db/schema';
import { ownedRow, owns } from '@/lib/db/tenancy';
import { contributeLater } from '@/lib/library/evidence';
import { loadResolved } from '@/lib/library/resolve';
import { plantOfItsOwnLater } from '@/lib/library/suggestions';
import { followLibrary } from '@/lib/library/sync';

export type ActionResult = { ok: true } | { ok: false; error: string };

function slugify(name: string): string {
	// "Jalapeño" is jalapeno, not jalape-o.
	return name
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
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

const addSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) });

/**
 * "Add to my garden": a copy of a library plant, which then follows the
 * library like every other copy. It lands back on the article, which offers
 * to sow some - adding a plant you don't put anywhere is allowed, and is how
 * figgy knows to say when its window opens.
 */
export async function addToGarden(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const parsed = addSchema.safeParse({ slug: form.get('slug') });
	if (!parsed.success) return { ok: false, error: 'No such plant.' };

	const region = await householdRegion(householdId);
	const [plant] = await db.transaction(async (tx) => {
		const [found] = await loadResolved(tx, [parsed.data.slug], region);
		if (!found) return [null];
		return [{ found, report: await followLibrary(tx, householdId, found) }];
	});
	if (!plant) return { ok: false, error: 'figgy doesn’t know that plant.' };
	if (plant.report.plantTypeId === null) {
		return {
			ok: false,
			error: `You already have a plant of your own called ${plant.found.commonName}.`,
		};
	}

	refresh(plant.found.slug);
	redirect(`/plants/${plant.found.slug}?added=1`);
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

	const made = await db
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
		.returning({ id: plantType.id })
		.get();

	// The library doesn't have it - that is why it was typed in - so it is
	// offered to the library, and kept up to date as its months go in.
	await plantOfItsOwnLater(householdId, made.id);
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

	await plantOfItsOwnLater(householdId, id);
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
	const place = await db
		.select({ id: environment.id })
		.from(environment)
		.where(
			and(
				currentPlaces(householdId),
				eq(environment.id, parsed.data.environmentId),
			),
		)
		.get();
	if (!place) return { ok: false, error: 'No such place.' };

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

	const made = await db
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
		.returning({ id: planting.id })
		.get();

	await contributeLater(householdId, [made.id]);
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

	// Bringing one back means it is growing again, which it cannot be in a
	// place that has been taken out of the garden.
	if (parsed.data.status === 'active') {
		const where = await db
			.select({ archivedOn: environment.archivedOn })
			.from(planting)
			.innerJoin(environment, eq(planting.environmentId, environment.id))
			.where(ownedRow(planting, parsed.data.plantingId, householdId))
			.get();
		if (where?.archivedOn) {
			return { ok: false, error: 'Its place has been removed from the garden.' };
		}
	}

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

	await contributeLater(householdId, [parsed.data.plantingId]);
	refresh(parsed.data.slug);
	return { ok: true };
}
