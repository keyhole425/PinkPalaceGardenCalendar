'use server';

/**
 * Places: the beds, the hothouse, pots and the orchard. Adding one, changing
 * it, and taking it out of the garden.
 *
 * Anyone in the household can do all three, as they can sow and clear. A place
 * is part of looking after the garden, not of running the household.
 */
import { and, count, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireHousehold } from '@/lib/auth/context';
import { today } from '@/lib/dates';
import { db } from '@/lib/db/client';
import { currentPlaces, loadOccupants } from '@/lib/db/queries/beds';
import { ENVIRONMENT_KINDS, environment, planting } from '@/lib/db/schema';
import { ownedRow, owns } from '@/lib/db/tenancy';

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * As many spots as a bed may have each way. Sowing takes a spot of 0-11
 * (`sowSchema` in `actions/beds.ts`), so a grid of 12 is the largest it can
 * fill.
 */
const MAX_SPOTS = 12;

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
}

function refresh(slug?: string) {
	revalidatePath('/garden');
	revalidatePath('/now');
	revalidatePath('/grid');
	if (slug) revalidatePath(`/garden/${slug}`);
}

const spots = (way: string) =>
	z.coerce
		.number({ message: `Say how many spots ${way}` })
		.int(`Spots ${way} is a whole number`)
		.min(1, `At least one spot ${way}`)
		.max(MAX_SPOTS, `At most ${MAX_SPOTS} spots ${way}`);

const centimetres = z.coerce.number().int().positive().max(100_000).optional();

/**
 * Every place but the orchard is a grid of spots, and says how big. There is
 * no default: a bed that quietly became 4 by 2 was how every bed ended up with
 * eight spots whatever its size.
 */
const placeSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('orchard'),
	}),
	z.object({
		kind: z.enum(ENVIRONMENT_KINDS.filter((k) => k !== 'orchard')),
		gridCols: spots('across'),
		gridRows: spots('deep'),
	}),
]);

const detailsSchema = z.object({
	name: z.string().trim().min(1, 'Give it a name').max(80),
	frostFree: z.boolean(),
	windowShiftMonths: z.coerce.number().int().min(-6).max(6).default(0),
	widthCm: centimetres,
	lengthCm: centimetres,
	notes: z.string().trim().max(2000).optional(),
});

type PlaceValues = {
	name: string;
	kind: (typeof ENVIRONMENT_KINDS)[number];
	frostFree: boolean;
	windowShiftMonths: number;
	widthCm: number | null;
	lengthCm: number | null;
	gridCols: number | null;
	gridRows: number | null;
	notes: string | null;
};

/** The form as a row, or the first thing wrong with it. */
function readPlaceForm(
	form: FormData,
): { ok: true; values: PlaceValues } | { ok: false; error: string } {
	const details = detailsSchema.safeParse({
		name: form.get('name'),
		frostFree: form.get('frostFree') === 'on',
		windowShiftMonths: form.get('windowShiftMonths') || 0,
		widthCm: form.get('widthCm') || undefined,
		lengthCm: form.get('lengthCm') || undefined,
		notes: form.get('notes') || undefined,
	});
	if (!details.success) {
		return {
			ok: false,
			error: details.error.issues[0]?.message ?? 'Check the form',
		};
	}
	const shape = placeSchema.safeParse({
		kind: form.get('kind'),
		// An empty box is "not said", not zero.
		gridCols: form.get('gridCols') || undefined,
		gridRows: form.get('gridRows') || undefined,
	});
	if (!shape.success) {
		return { ok: false, error: shape.error.issues[0]?.message ?? 'Check the form' };
	}

	return {
		ok: true,
		values: {
			...details.data,
			kind: shape.data.kind,
			widthCm: details.data.widthCm ?? null,
			lengthCm: details.data.lengthCm ?? null,
			notes: details.data.notes ?? null,
			gridCols: shape.data.kind === 'orchard' ? null : shape.data.gridCols,
			gridRows: shape.data.kind === 'orchard' ? null : shape.data.gridRows,
		},
	};
}

export async function createPlace(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const read = readPlaceForm(form);
	if (!read.ok) return read;

	let slug = slugify(read.values.name);
	if (!slug) return { ok: false, error: 'That name has no letters in it.' };
	// Removed places keep their slug (the unique index still covers them), so
	// this looks at every place, not only the current ones.
	let attempt = 1;
	while (
		await db
			.select({ id: environment.id })
			.from(environment)
			.where(and(owns(environment, householdId), eq(environment.slug, slug)))
			.get()
	) {
		attempt++;
		slug = `${slugify(read.values.name)}-${attempt}`;
	}

	await db
		.insert(environment)
		.values({ householdId, slug, ...read.values })
		.run();
	refresh(slug);
	redirect(`/garden/${slug}`);
}

/**
 * Changes everything but the slug, so a renamed bed keeps its address and
 * anything pointing at it still lands there.
 */
export async function updatePlace(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const id = Number(form.get('environmentId'));
	if (!Number.isInteger(id) || id <= 0) {
		return { ok: false, error: 'No such place.' };
	}
	const read = readPlaceForm(form);
	if (!read.ok) return read;

	const place = await db
		.select({ id: environment.id, slug: environment.slug })
		.from(environment)
		.where(and(currentPlaces(householdId), eq(environment.id, id)))
		.get();
	if (!place) return { ok: false, error: 'No such place.' };

	// Shrinking a bed under something growing in it would leave a plant
	// standing outside its own plan. Say what is in the way instead.
	const { gridCols, gridRows } = read.values;
	if (gridCols !== null && gridRows !== null) {
		const occupants = await loadOccupants(householdId, id);
		const across = occupants.find((o) => o.posX !== null && o.posX >= gridCols);
		if (across?.posX != null) {
			return {
				ok: false,
				error: `${across.label} is in column ${across.posX + 1}. Clear it first, or keep at least ${across.posX + 1} across.`,
			};
		}
		const deep = occupants.find((o) => o.posY !== null && o.posY >= gridRows);
		if (deep?.posY != null) {
			return {
				ok: false,
				error: `${deep.label} is in row ${deep.posY + 1}. Clear it first, or keep at least ${deep.posY + 1} deep.`,
			};
		}
	}

	await db
		.update(environment)
		.set(read.values)
		.where(ownedRow(environment, id, householdId))
		.run();
	refresh(place.slug);
	return { ok: true };
}

/**
 * Takes a place out of the garden.
 *
 * Never while something is growing in it: that would hide a live plant and
 * its jobs along with the bed. Once it is empty, a place nothing has ever
 * grown in is simply deleted; one with a history is archived, so what grew
 * there still says where.
 */
export async function removePlace(
	_previous: ActionResult | null,
	form: FormData,
): Promise<ActionResult> {
	const { householdId } = await requireHousehold();
	const id = Number(form.get('environmentId'));
	if (!Number.isInteger(id) || id <= 0) {
		return { ok: false, error: 'No such place.' };
	}

	const place = await db
		.select({ id: environment.id, slug: environment.slug })
		.from(environment)
		.where(and(currentPlaces(householdId), eq(environment.id, id)))
		.get();
	if (!place) return { ok: false, error: 'No such place.' };

	const [growing] = await db
		.select({ n: count() })
		.from(planting)
		.where(
			and(
				owns(planting, householdId),
				eq(planting.environmentId, id),
				// What the place's page lists under "Growing here now".
				ne(planting.status, 'removed'),
			),
		)
		.all();
	if ((growing?.n ?? 0) > 0) {
		return {
			ok: false,
			error: `${growing?.n === 1 ? 'One thing is' : `${growing?.n} things are`} still growing here. Clear ${growing?.n === 1 ? 'it' : 'them'} first.`,
		};
	}

	const [ever] = await db
		.select({ n: count() })
		.from(planting)
		.where(and(owns(planting, householdId), eq(planting.environmentId, id)))
		.all();

	if ((ever?.n ?? 0) === 0) {
		await db
			.delete(environment)
			.where(ownedRow(environment, id, householdId))
			.run();
	} else {
		await db
			.update(environment)
			.set({ archivedOn: today() })
			.where(ownedRow(environment, id, householdId))
			.run();
	}

	refresh(place.slug);
	redirect('/garden');
}
