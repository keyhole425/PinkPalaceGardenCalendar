import { execFileSync } from 'node:child_process';
import { expect, type Page, test } from '@playwright/test';
import { E2E_ENV } from './fixtures';

function invite(...args: string[]): string {
	const out = execFileSync('npx', ['tsx', 'scripts/admin/invite.ts', ...args], {
		env: { ...process.env, ...E2E_ENV },
		encoding: 'utf8',
	});
	const url = out.match(/https?:\/\/\S+\/join\/\S+/)?.[0];
	if (!url) throw new Error(`No link in:\n${out}`);
	return new URL(url).pathname;
}

async function join(page: Page, path: string, who: string, garden?: string) {
	await page.goto(path);
	if (garden) await page.getByLabel('Your garden').fill(garden);
	await page.getByLabel('Your name').fill(who);
	await page.getByLabel('Email').fill(`${who.toLowerCase()}@figgy.test`);
	await page.getByLabel('Password').fill(`a long password for ${who}`);
	await page
		.getByRole('button', { name: garden ? 'Start my garden' : 'Join' })
		.click();
	await expect(page).toHaveURL(/\/now/);
}

test('a new garden’s admin is offered the setup tour, and skipping it sticks', async ({
	page,
}) => {
	await join(page, invite('--new-garden'), 'Tourist', 'Tour garden');

	const offer = page.getByRole('complementary', { name: 'Getting started' });
	await expect(offer).toContainText('Welcome to Tour garden');
	await offer.getByRole('button', { name: 'Show me around' }).click();

	const card = page.getByRole('dialog');
	await expect(page).toHaveURL(/\/settings/);
	await expect(card).toContainText('Setting up · 1 of 4');
	await expect(
		card.getByRole('heading', { name: 'Name your garden' }),
	).toBeVisible();
	await expect(page.locator('[data-tour-active]')).toHaveCount(1);

	await card.getByRole('button', { name: 'Next' }).click();
	await expect(page).toHaveURL(/\/garden/);
	await expect(card).toContainText('2 of 4');

	await card.getByRole('button', { name: 'Skip the tour' }).click();
	await expect(card).toHaveCount(0);
	await page.goto('/now');
	await expect(offer).toHaveCount(0);
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a member gets the look round, and no setting up', async ({ page }) => {
	await join(page, invite('--household', '1'), 'Newcomer');

	const offer = page.getByRole('complementary', { name: 'Getting started' });
	await expect(offer).toContainText('A quick look round');
	await offer.getByRole('button', { name: 'Show me around' }).click();
	const card = page.getByRole('dialog');
	await expect(card).toContainText('Looking round · 1 of');
	await expect(card.getByRole('heading', { name: 'What’s on' })).toBeVisible();
});

test('on a phone the card is a sheet above the tabs', async ({ browser }) => {
	const context = await browser.newContext({
		viewport: { width: 375, height: 812 },
	});
	const page = await context.newPage();
	await join(page, invite('--household', '1'), 'Thumb');

	await page.getByRole('button', { name: 'Show me around' }).click();
	const card = page.getByRole('dialog');
	await expect(card).toBeVisible();
	const box = await card.boundingBox();
	const tabs = await page
		.getByRole('navigation', { name: 'Sections' })
		.boundingBox();
	if (!box || !tabs) throw new Error('nothing to measure');
	// Full width less the gutters, and sitting on top of the tab bar.
	expect(box.width).toBeGreaterThan(340);
	expect(box.y + box.height).toBeLessThanOrEqual(tabs.y + 1);
	await context.close();
});
