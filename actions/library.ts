'use server';

/**
 * The library's side of things: a garden choosing whether to share what it
 * grows, anyone suggesting something from an article, and a site admin
 * deciding what the library says.
 *
 * The curator's actions check site admin from the database on every call,
 * as starting a garden does. Everything they change is published to every
 * garden that follows the plant; nothing a garden made its own is touched.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { Citation } from '@/lib/ai/schema';
import { isSiteAdmin, requireHousehold } from '@/lib/auth/context';
import { opaqueKeys } from '@/lib/crypto/secretbox';
import { db } from '@/lib/db/client';
import { openSuggestion } from '@/lib/db/queries/curator';
import { householdRegion } from '@/lib/db/queries/household';
import {
	household,
	libraryPlant,
	librarySuggestion,
	plantType,
	type RegionId,
} from '@/lib/db/schema';
import { type HouseholdId, ownedRow, owns } from '@/lib/db/tenancy';
import {
	afterResponse,
	contribute,
	contributePlant,
	libraryPlantings,
	namesOf,
	withdraw,
} from '@/lib/library/evidence';
import {
	addToLibrary,
	linkSubject,
	publish,
	replaceRules,
	setRegionNote,
} from '@/lib/library/publish';
import { newPlantPayload, noteFor } from '@/lib/library/suggestions';

export type LibraryResult =
	| { ok: true; message?: string }
	| { ok: false; error: string };

function refresh(slug?: string) {
	revalidatePath('/library');
	revalidatePath('/plants');
	revalidatePath('/now');
	revalidatePath('/grid');
	if (slug) {
		revalidatePath(`/library/${slug}`);
		revalidatePath(`/plants/${slug}`);
	}
}

/**
 * Whether this garden's grows help the library. Turning it off deletes
 * everything the garden gave; turning it back on gives its grows again.
 */
export async function setShareGrowing(
	_previous: LibraryResult | null,
	form: FormData,
): Promise<LibraryResult> {
	const { householdId, role } = await requireHousehold();
	if (role !== 'admin') {
		return { ok: false, error: 'Only an admin of this household can change that.' };
	}
	const share = form.get('share') === 'on';
	await db
		.update(household)
		.set({ shareGrowing: share })
		.where(eq(household.id, householdId))
		.run();
	if (share) {
		await afterResponse(async () =>
			contribute(householdId, await libraryPlantings(householdId)),
		);
	} else {
		await withdraw(householdId);
	}
	revalidatePath('/settings');
	return { ok: true };
}

const noteSchema = z.object({
	slug: z.string().regex(/^[a-z0-9-]+$/),
	text: z
		.string()
		.trim()
		.min(3, 'Say a little more than that.')
		.max(1000, 'Keep it under a thousand characters.'),
});

/** "Suggest something" on an article: words for a site admin to read. */
export async function suggestSomething(
	_previous: LibraryResult | null,
	form: FormData,
): Promise<LibraryResult> {
	const { householdId } = await requireHousehold();
	const parsed = noteSchema.safeParse({
		slug: form.get('slug'),
		text: form.get('text'),
	});
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? 'Check the note.',
		};
	}
	// The household's copy names its library plant; failing that, the slug is
	// the library's own.
	const copy = await db
		.select({ libraryPlantId: plantType.libraryPlantId })
		.from(plantType)
		.where(and(owns(plantType, householdId), eq(plantType.slug, parsed.data.slug)))
		.get();
	const lib = copy
		? copy.libraryPlantId
		: (
				await db
					.select({ id: libraryPlant.id })
					.from(libraryPlant)
					.where(eq(libraryPlant.slug, parsed.data.slug))
					.get()
			)?.id;
	if (!lib) return { ok: false, error: 'The library doesn’t have this plant.' };

	await noteFor(
		householdId,
		lib,
		await householdRegion(householdId),
		parsed.data.text,
		await namesOf(householdId),
	);
	revalidatePath('/library');
	return { ok: true, message: 'Sent. A site admin reads every one.' };
}

const NOT_CURATOR: LibraryResult = {
	ok: false,
	error: 'Only a site admin can change the library.',
};

async function curator(): Promise<{
	region: RegionId;
	householdId: HouseholdId;
} | null> {
	const ctx = await requireHousehold();
	if (!(await isSiteAdmin(ctx.userId))) return null;
	return {
		region: await householdRegion(ctx.householdId),
		householdId: ctx.householdId,
	};
}

async function decide(id: number, status: 'accepted' | 'rejected') {
	await db
		.update(librarySuggestion)
		.set({ status, reviewedAt: new Date().toISOString() })
		.where(eq(librarySuggestion.id, id))
		.run();
}

async function slugOf(libraryPlantId: number): Promise<string | undefined> {
	return (
		await db
			.select({ slug: libraryPlant.slug })
			.from(libraryPlant)
			.where(eq(libraryPlant.id, libraryPlantId))
			.get()
	)?.slug;
}

const acceptSchema = z.object({
	id: z.coerce.number().int().positive(),
	/** For a new plant: its own, a kind of another, or the same as another. */
	as: z.enum(['new', 'kind', 'same']).optional(),
	target: z.coerce.number().int().positive().optional(),
});

/** Takes a suggestion into the library, and the library to every garden. */
export async function acceptSuggestion(
	_previous: LibraryResult | null,
	form: FormData,
): Promise<LibraryResult> {
	const me = await curator();
	if (!me) return NOT_CURATOR;
	const parsed = acceptSchema.safeParse({
		id: form.get('id'),
		as: form.get('as') || undefined,
		target: form.get('target') || undefined,
	});
	if (!parsed.success) return { ok: false, error: 'Nothing to accept.' };
	const found = await openSuggestion(parsed.data.id);
	if (!found) return { ok: false, error: 'That one has already been decided.' };
	const { row } = found;

	if (found.kind === 'new_plant') {
		const how = parsed.data.as ?? 'new';
		if (how !== 'new' && !parsed.data.target) {
			return { ok: false, error: 'Choose which plant it is.' };
		}
		const outcome = await db.transaction(async (tx) => {
			const into =
				how === 'same'
					? {
							id: parsed.data.target ?? 0,
							slug:
								(
									await tx
										.select({ slug: libraryPlant.slug })
										.from(libraryPlant)
										.where(eq(libraryPlant.id, parsed.data.target ?? 0))
										.get()
								)?.slug ?? '',
						}
					: await addToLibrary(
							tx,
							found.payload,
							row.region,
							how === 'kind' ? (parsed.data.target ?? null) : null,
						);
			if (!into.slug) return null;
			const linked = row.subjectKey
				? await linkSubject(tx, row.subjectKey, into.id)
				: null;
			await tx
				.update(librarySuggestion)
				.set({ status: 'accepted', reviewedAt: new Date().toISOString() })
				.where(eq(librarySuggestion.id, row.id))
				.run();
			return { into, linked };
		});
		if (!outcome) return { ok: false, error: 'No such plant to put it with.' };
		if (outcome.linked) {
			await contributePlant(outcome.linked.hid, outcome.linked.plantTypeId);
		}
		refresh(outcome.into.slug);
		return {
			ok: true,
			message:
				how === 'same'
					? 'Filed with the plant the library already had.'
					: `In the library, as ${outcome.into.slug}.`,
		};
	}

	const libraryPlantId = row.libraryPlantId;
	if (!libraryPlantId) return { ok: false, error: 'That plant has gone.' };
	const slug = await slugOf(libraryPlantId);
	if (!slug) return { ok: false, error: 'That plant has gone.' };

	if (found.kind === 'note') {
		// A note is read, not applied; what it says goes in by hand.
		await decide(row.id, 'accepted');
		refresh(slug);
		return { ok: true, message: 'Marked read.' };
	}

	const gardens = await db.transaction(async (tx) => {
		const plant = { id: libraryPlantId, slug };
		if (found.kind === 'rule_change') {
			const { rule, removed } = found.payload;
			await replaceRules(tx, plant, row.region, rule.action, removed ? null : rule);
		} else {
			for (const rule of found.payload.rules) {
				await replaceRules(tx, plant, row.region, rule.action, rule);
			}
			const current = await tx
				.select({ citations: libraryPlant.citations })
				.from(libraryPlant)
				.where(eq(libraryPlant.id, libraryPlantId))
				.get();
			const had: Citation[] = current?.citations
				? JSON.parse(current.citations)
				: [];
			const urls = new Set(had.map((c) => c.url));
			await tx
				.update(libraryPlant)
				.set({
					citations: JSON.stringify([
						...had,
						...found.payload.citations.filter((c) => !urls.has(c.url)),
					]),
				})
				.where(eq(libraryPlant.id, libraryPlantId))
				.run();
		}
		await tx
			.update(librarySuggestion)
			.set({ status: 'accepted', reviewedAt: new Date().toISOString() })
			.where(eq(librarySuggestion.id, row.id))
			.run();
		return await publish(tx, libraryPlantId);
	});
	refresh(slug);
	return {
		ok: true,
		message:
			gardens === 1
				? 'Accepted. One garden follows this plant.'
				: `Accepted. ${gardens} gardens follow this plant.`,
	};
}

/** Turns a suggestion down. It stays turned down: the same one isn't made again. */
export async function rejectSuggestion(
	_previous: LibraryResult | null,
	form: FormData,
): Promise<LibraryResult> {
	if (!(await curator())) return NOT_CURATOR;
	const id = Number(form.get('id'));
	const found = Number.isInteger(id) ? await openSuggestion(id) : null;
	if (!found) return { ok: false, error: 'That one has already been decided.' };
	await decide(id, 'rejected');
	refresh(
		found.row.libraryPlantId ? await slugOf(found.row.libraryPlantId) : undefined,
	);
	return { ok: true, message: 'Turned down.' };
}

const text = z
	.string()
	.trim()
	.max(5000)
	.transform((v) => v || null);

const articleSchema = z.object({
	id: z.coerce.number().int().positive(),
	summary: text,
	regionNote: text,
	growingMd: text,
	careMd: text,
	harvestMd: text,
	problemsMd: text,
	findingsMd: text,
});

/** The article's words, as a site admin writes them. */
export async function saveArticle(
	_previous: LibraryResult | null,
	form: FormData,
): Promise<LibraryResult> {
	const me = await curator();
	if (!me) return NOT_CURATOR;
	const get = (k: string) => form.get(k)?.toString() ?? '';
	const parsed = articleSchema.safeParse({
		id: form.get('id'),
		summary: get('summary'),
		regionNote: get('regionNote'),
		growingMd: get('growingMd'),
		careMd: get('careMd'),
		harvestMd: get('harvestMd'),
		problemsMd: get('problemsMd'),
		findingsMd: get('findingsMd'),
	});
	if (!parsed.success) {
		return {
			ok: false,
			error: parsed.error.issues[0]?.message ?? 'Check the article.',
		};
	}
	const { id, regionNote, ...fields } = parsed.data;
	const slug = await slugOf(id);
	if (!slug) return { ok: false, error: 'That plant has gone.' };

	const gardens = await db.transaction(async (tx) => {
		await tx.update(libraryPlant).set(fields).where(eq(libraryPlant.id, id)).run();
		await setRegionNote(tx, id, me.region, regionNote);
		return await publish(tx, id);
	});
	refresh(slug);
	return {
		ok: true,
		message:
			gardens === 1
				? 'Saved, and one garden follows it.'
				: `Saved, and ${gardens} gardens follow it.`,
	};
}

const promoteSchema = z.object({
	plantTypeId: z.coerce.number().int().positive(),
	as: z.enum(['new', 'kind', 'same']),
	target: z.coerce.number().int().positive().optional(),
});

/**
 * A site admin's own plant, into the library from its page, without going
 * through the queue: the same three ways in as a new-plant suggestion, and
 * the copy is linked the same way. Only a plant of the admin's own garden -
 * one from another garden comes in through /library, unnamed.
 */
export async function promoteToLibrary(
	_previous: LibraryResult | null,
	form: FormData,
): Promise<LibraryResult> {
	const me = await curator();
	if (!me) return NOT_CURATOR;
	const parsed = promoteSchema.safeParse({
		plantTypeId: form.get('plantTypeId'),
		as: form.get('as'),
		target: form.get('target') || undefined,
	});
	if (!parsed.success)
		return { ok: false, error: 'Choose how it joins the library.' };
	const { plantTypeId, as: how, target } = parsed.data;
	if (how !== 'new' && !target)
		return { ok: false, error: 'Choose which plant it is.' };

	const payload = await newPlantPayload(me.householdId, plantTypeId);
	if (!payload)
		return { ok: false, error: 'That plant is already in the library.' };
	const own = await db
		.select({ slug: plantType.slug, userModifiedAt: plantType.userModifiedAt })
		.from(plantType)
		.where(ownedRow(plantType, plantTypeId, me.householdId))
		.get();
	if (!own) return { ok: false, error: 'No such plant.' };

	const joined = await db.transaction(async (tx) => {
		const into =
			how === 'same'
				? await tx
						.select({ id: libraryPlant.id, slug: libraryPlant.slug })
						.from(libraryPlant)
						.where(eq(libraryPlant.id, target ?? 0))
						.get()
				: await addToLibrary(
						tx,
						payload,
						me.region,
						how === 'kind' ? (target ?? null) : null,
					);
		if (!into) return null;
		const lib = await tx
			.select({ revision: libraryPlant.revision })
			.from(libraryPlant)
			.where(eq(libraryPlant.id, into.id))
			.get();
		// Linked, with its fields and rules still its own: nothing about it
		// changes today, and its grows count from here, the earlier ones too.
		await tx
			.update(plantType)
			.set({
				libraryPlantId: into.id,
				libraryRevision: lib?.revision ?? null,
				userModifiedAt: own.userModifiedAt ?? new Date().toISOString(),
			})
			.where(ownedRow(plantType, plantTypeId, me.householdId))
			.run();
		// Any offer of this plant already in the queue is answered by this.
		await tx
			.update(librarySuggestion)
			.set({ status: 'accepted', reviewedAt: new Date().toISOString() })
			.where(
				and(
					eq(librarySuggestion.status, 'open'),
					inArray(librarySuggestion.subjectKey, opaqueKeys(`plant:${plantTypeId}`)),
				),
			)
			.run();
		return into;
	});
	if (!joined) return { ok: false, error: 'No such plant to put it with.' };

	await contributePlant(me.householdId, plantTypeId);
	refresh(own.slug);
	redirect(`/plants/${own.slug}?promoted=1`);
}
