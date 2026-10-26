/**
 * Who gets which tour, which steps they see, and that saying no sticks.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actAs } from '@/lib/auth/testing';
import { createTempGarden, GARDEN, type TempGarden } from '@/lib/db/testing';
import { stepsFor, type TourContext, toursFor } from './steps';

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const ADMIN: TourContext = {
	role: 'admin',
	siteAdmin: false,
	aiAvailable: false,
	householdName: 'Pink Palace',
};

describe('the steps', () => {
	it('give a member only the look round', () => {
		expect(toursFor({ ...ADMIN, role: 'member' })).toEqual(['basics']);
		expect(toursFor(ADMIN)).toEqual(['setup', 'basics']);
	});

	it('leave out Claude where the household has not switched it on', () => {
		const without = stepsFor('basics', ADMIN).map((s) => s.id);
		const withAi = stepsFor('basics', { ...ADMIN, aiAvailable: true }).map(
			(s) => s.id,
		);
		expect(without).not.toContain('sentence');
		expect(without).not.toContain('ask');
		expect(withAi).toContain('sentence');
		expect(withAi).toContain('ask');
	});

	it('show new gardens to a site admin only', () => {
		expect(stepsFor('setup', ADMIN).map((s) => s.id)).not.toContain('new-gardens');
		expect(
			stepsFor('setup', { ...ADMIN, siteAdmin: true }).map((s) => s.id),
		).toContain('new-gardens');
	});

	it('all say where they are and what they point at', () => {
		for (const tour of ['setup', 'basics'] as const) {
			for (const step of stepsFor(tour, {
				...ADMIN,
				siteAdmin: true,
				aiAvailable: true,
			})) {
				expect(step.route).toMatch(/^\//);
				expect(step.title.length).toBeGreaterThan(0);
				expect(step.body.length).toBeGreaterThan(0);
			}
		}
	});
});

let garden: TempGarden;

beforeEach(async () => {
	garden?.cleanup();
	garden = await createTempGarden();
	return () => garden.cleanup();
});

async function modules() {
	vi.resetModules();
	const client = await import('@/lib/db/client');
	const seed = await import('@/db/seed/seed');
	const schema = await import('@/lib/db/schema');
	const state = await import('./state');
	const actions = await import('@/actions/tour');
	await seed.seedGarden(client.db);
	for (const id of ['admin-1', 'member-1', 'other-1']) {
		await client.db
			.insert(schema.user)
			.values({ id, name: id, email: `${id}@figgy.test` })
			.run();
	}
	return { db: client.db, schema, state, actions };
}

function context(userId: string, role: 'admin' | 'member') {
	return {
		userId,
		userName: userId,
		householdId: GARDEN,
		householdName: 'Pink Palace',
		role,
	};
}

describe('where someone is', () => {
	it('starts an admin with the setup tour, offered rather than begun', async () => {
		const { state } = await modules();
		const tour = await state.activeTour(context('admin-1', 'admin'));
		expect(tour).toMatchObject({ tourId: 'setup', status: 'pending', startAt: 0 });
		expect(tour?.thenBasics).toBe(true);
	});

	it('starts a member with the look round', async () => {
		const { state } = await modules();
		const tour = await state.activeTour(context('member-1', 'member'));
		expect(tour).toMatchObject({ tourId: 'basics', status: 'pending' });
	});

	it('picks up where they left off', async () => {
		const { state, actions } = await modules();
		actAs({ userId: 'admin-1', role: 'admin' });
		await actions.tourAt('setup', 'invite');
		const tour = await state.activeTour(context('admin-1', 'admin'));
		expect(tour?.status).toBe('in_progress');
		expect(tour?.steps[tour.startAt]?.id).toBe('invite');
	});

	it('goes straight from setting up into the look round', async () => {
		const { state, actions } = await modules();
		actAs({ userId: 'admin-1', role: 'admin' });
		await actions.finishTour('setup');
		const tour = await state.activeTour(context('admin-1', 'admin'));
		expect(tour).toMatchObject({
			tourId: 'basics',
			status: 'in_progress',
			startAt: 0,
		});
	});

	it('stays away for good after "no thanks", until asked for again', async () => {
		const { state, actions } = await modules();
		actAs({ userId: 'admin-1', role: 'admin' });
		await actions.dismissTours();
		expect(await state.activeTour(context('admin-1', 'admin'))).toBeNull();

		await actions.restartTours();
		expect(await state.activeTour(context('admin-1', 'admin'))).toMatchObject({
			tourId: 'setup',
			status: 'pending',
		});
	});

	it('only ever changes the signed-in person', async () => {
		const { db, schema, state, actions } = await modules();
		actAs({ userId: 'other-1', role: 'admin' });
		await actions.dismissTours();
		await actions.tourAt('setup', 'name');

		expect(await state.activeTour(context('admin-1', 'admin'))).toMatchObject({
			tourId: 'setup',
			status: 'pending',
		});
		const rows = await db.select().from(schema.userTour).all();
		expect(rows.every((r) => r.userId === 'other-1')).toBe(true);
	});

	it('ignores a tour it has never heard of', async () => {
		const { db, schema, actions } = await modules();
		actAs({ userId: 'admin-1', role: 'admin' });
		await actions.tourAt('everything', 'x');
		await actions.finishTour(42);
		expect(await db.select().from(schema.userTour).all()).toHaveLength(0);
	});
});
