import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { E2E_ENV, GARDENER } from './fixtures';

/** Mints an invite the way an admin would, from the command line. */
function invite(...args: string[]): string {
	const out = execFileSync('npx', ['tsx', 'scripts/admin/invite.ts', ...args], {
		env: { ...process.env, ...E2E_ENV },
		encoding: 'utf8',
	});
	const url = out.match(/https?:\/\/\S+\/join\/\S+/)?.[0];
	if (!url) throw new Error(`No link in:\n${out}`);
	return new URL(url).pathname;
}

test('a stranger is sent to sign in, and comes back where they were going', async ({
	page,
}) => {
	await page.goto('/plants/lemon');
	await expect(page).toHaveURL(/\/login\?next=%2Fplants%2Flemon/);

	await page.getByLabel('Email').fill(GARDENER.email);
	await page.getByLabel('Password').fill(GARDENER.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/plants\/lemon/);
	await expect(
		page.getByRole('heading', { name: 'Lemon', level: 1 }),
	).toBeVisible();
});

test('a wrong password is refused without saying which half was wrong', async ({
	page,
}) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill(GARDENER.email);
	await page.getByLabel('Password').fill('not the password at all');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(
		page
			.getByRole('alert')
			.filter({ hasText: 'That email and password do not match.' }),
	).toBeVisible();
	await expect(page).toHaveURL(/\/login/);
});

test('an invite starts a garden of its own, which cannot see the Pink Palace', async ({
	page,
}) => {
	await page.goto(invite('--new-garden'));
	await expect(
		page.getByRole('heading', { name: 'Start your garden' }),
	).toBeVisible();

	await page.getByLabel('Your garden').fill('The back yard');
	await page.getByLabel('Your name').fill('Friend');
	await page.getByLabel('Email').fill('friend@figgy.test');
	await page.getByLabel('Password').fill('a long friendly password');
	await page.getByRole('button', { name: 'Start my garden' }).click();
	await expect(page).toHaveURL(/\/now/);

	// The starter catalogue is there; the Pink Palace's orchard is not.
	await page.goto('/plants');
	await expect(
		page.getByRole('link', { name: 'Tomato', exact: true }),
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Lemon', exact: true })).toHaveCount(
		0,
	);
	const lemon = await page.goto('/plants/lemon');
	expect(lemon?.status()).toBe(404);

	await page.goto('/settings');
	await expect(page.getByRole('heading', { name: 'The back yard' })).toBeVisible();
	// Their own garden's admin, but not figgy's: the housekeeping numbers
	// are for site admins only.
	await expect(
		page.getByRole('heading', { name: 'This garden in figgy' }),
	).toHaveCount(0);
});

test('an invite into a household lands them in it', async ({ page }) => {
	await page.goto(invite('--household', '1'));
	await expect(
		page.getByRole('heading', { name: 'Join Pink Palace' }),
	).toBeVisible();

	await page.getByLabel('Your name').fill('Housemate');
	await page.getByLabel('Email').fill('housemate@figgy.test');
	await page.getByLabel('Password').fill('a long housemate password');
	await page.getByRole('button', { name: 'Join' }).click();
	await expect(page).toHaveURL(/\/now/);

	await page.goto('/plants/lemon');
	await expect(
		page.getByRole('heading', { name: 'Lemon', level: 1 }),
	).toBeVisible();

	// A member sees the household, not the controls for running it.
	await page.goto('/settings');
	await expect(page.getByText('ask an admin of this household')).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Make an invite link' }),
	).toHaveCount(0);
});

test('an invite works once', async ({ browser }) => {
	const path = invite('--household', '1');

	const first = await browser.newPage();
	await first.goto(path);
	await first.getByLabel('Your name').fill('First');
	await first.getByLabel('Email').fill('first@figgy.test');
	await first.getByLabel('Password').fill('a long first password');
	await first.getByRole('button', { name: 'Join' }).click();
	await expect(first).toHaveURL(/\/now/);

	const second = await browser.newPage();
	await second.goto(path);
	await expect(
		second.getByRole('heading', { name: 'That link has run out' }),
	).toBeVisible();
});
