'use server';

/**
 * Moving through the first-run tours. Each of these only ever touches the
 * signed-in person's own rows: the user id comes from the session, never the
 * request.
 */
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireHousehold } from '@/lib/auth/context';
import { db } from '@/lib/db/client';
import { TOUR_IDS, type TourId, userTour } from '@/lib/db/schema';

type Status = (typeof userTour.$inferInsert)['status'];

function isTour(value: unknown): value is TourId {
	return (
		typeof value === 'string' && (TOUR_IDS as readonly string[]).includes(value)
	);
}

async function set(
	userId: string,
	tourId: TourId,
	status: Status,
	stepId: string | null,
) {
	const values = { status, stepId, updatedAt: new Date().toISOString() };
	await db
		.insert(userTour)
		.values({ userId, tourId, ...values })
		.onConflictDoUpdate({ target: [userTour.userId, userTour.tourId], set: values })
		.run();
}

/** Started, or moved on a step. */
export async function tourAt(tourId: unknown, stepId: unknown): Promise<void> {
	const { userId } = await requireHousehold();
	if (!isTour(tourId) || typeof stepId !== 'string') return;
	await set(userId, tourId, 'in_progress', stepId.slice(0, 40));
}

/** Done. Finishing the setup tour carries straight on into the basics. */
export async function finishTour(tourId: unknown): Promise<void> {
	const { userId } = await requireHousehold();
	if (!isTour(tourId)) return;
	await set(userId, tourId, 'completed', null);
	if (tourId === 'setup') {
		const basics = await db
			.select({ status: userTour.status })
			.from(userTour)
			.where(and(eq(userTour.userId, userId), eq(userTour.tourId, 'basics')))
			.get();
		if (!basics || basics.status === 'pending') {
			await set(userId, 'basics', 'in_progress', null);
		}
	}
	revalidatePath('/', 'layout');
}

/** "No thanks": every tour, for good, until asked for again. */
export async function dismissTours(): Promise<void> {
	const { userId } = await requireHousehold();
	for (const tourId of TOUR_IDS) await set(userId, tourId, 'dismissed', null);
	revalidatePath('/', 'layout');
}

/** From Settings: offer the tours again from the start. */
export async function restartTours(): Promise<void> {
	const { userId } = await requireHousehold();
	await db.delete(userTour).where(eq(userTour.userId, userId)).run();
	revalidatePath('/', 'layout');
}
