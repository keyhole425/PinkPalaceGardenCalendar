/** Where someone is in their tours, read on the server for the garden layout. */
import { eq } from 'drizzle-orm';
import { aiAvailable } from '@/lib/ai/client';
import { type HouseholdContext, isSiteAdmin } from '@/lib/auth/context';
import { db } from '@/lib/db/client';
import { type TourId, userTour } from '@/lib/db/schema';
import { stepsFor, type TourStep, toursFor } from './steps';

export type ActiveTour = {
	tourId: TourId;
	/** Pending is offered; in progress carries straight on. */
	status: 'pending' | 'in_progress';
	steps: TourStep[];
	startAt: number;
	householdName: string;
	/** Whether another tour follows this one. */
	thenBasics: boolean;
};

export async function activeTour(
	ctx: HouseholdContext,
): Promise<ActiveTour | null> {
	const rows = await db
		.select()
		.from(userTour)
		.where(eq(userTour.userId, ctx.userId))
		.all();
	const status = (id: TourId) =>
		rows.find((r) => r.tourId === id)?.status ?? 'pending';

	const order = toursFor({
		role: ctx.role,
		siteAdmin: false,
		aiAvailable: false,
		householdName: ctx.householdName,
	});
	const next = order.find((id) => {
		const s = status(id);
		return s === 'pending' || s === 'in_progress';
	});
	// The common case by far: tours done or declined, and nothing more to read.
	if (!next) return null;

	const [siteAdmin, ai] = await Promise.all([
		isSiteAdmin(ctx.userId),
		aiAvailable(ctx.householdId),
	]);
	const steps = stepsFor(next, {
		role: ctx.role,
		siteAdmin,
		aiAvailable: ai,
		householdName: ctx.householdName,
	});
	if (steps.length === 0) return null;

	const row = rows.find((r) => r.tourId === next);
	const at = steps.findIndex((s) => s.id === row?.stepId);
	return {
		tourId: next,
		status: status(next) === 'in_progress' ? 'in_progress' : 'pending',
		steps,
		startAt: Math.max(0, at),
		householdName: ctx.householdName,
		thenBasics:
			next === 'setup' &&
			order.includes('basics') &&
			status('basics') !== 'dismissed' &&
			status('basics') !== 'completed',
	};
}
