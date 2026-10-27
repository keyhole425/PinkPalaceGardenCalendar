import { expect, test } from '@playwright/test';

test('the year grid matches the orchard spreadsheet', async ({ page }) => {
	await page.goto('/grid');

	const lemon = page.locator('tr', {
		has: page.getByRole('link', { name: 'Lemon', exact: true }),
	});
	await expect(lemon).toBeVisible();

	// Every plant gets all three action rows, even where the spreadsheet was blank.
	await expect(page.getByText('Fertilise').first()).toBeVisible();
	await expect(page.getByText('needs review').first()).toBeVisible();

	// The alternatives the spreadsheet marked "OR" are still marked.
	await expect(page.getByText('or', { exact: true }).first()).toBeVisible();

	// Both cherries are one row on this view, because it is a view of types.
	await expect(page.getByRole('link', { name: 'Cherry', exact: true })).toHaveCount(
		1,
	);
});

test('the whole year fits on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/grid');

	await expect(
		page.getByRole('link', { name: 'Lemon', exact: true }),
	).toBeVisible();

	// Twelve one-letter months, the last of them still on screen, and nothing
	// to scroll sideways to: under three months fitted before.
	const table = page.getByRole('table');
	const months = table.locator('thead abbr');
	await expect(months).toHaveCount(12);
	const last = await months.last().boundingBox();
	expect(last).not.toBeNull();
	expect((last?.x ?? 0) + (last?.width ?? 0)).toBeLessThanOrEqual(375);

	const box = table.locator('xpath=..');
	const { scrollWidth, clientWidth } = await box.evaluate((el) => ({
		scrollWidth: el.scrollWidth,
		clientWidth: el.clientWidth,
	}));
	expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test('a job can be ticked off and taken back', async ({ page }) => {
	await page.goto('/now');

	const overdue = page.locator('section').filter({ hasText: 'Overdue' }).first();
	const first = overdue.locator('li').first();
	const label = await first.locator('p').first().innerText();

	await first.getByRole('button', { name: 'Done' }).click();

	// It leaves the overdue list and turns up as recently done.
	const recent = page.locator('section').filter({ hasText: 'Recently done' });
	await expect(recent).toContainText(label.trim());

	// And undoing puts it back where it was.
	await recent.getByRole('button', { name: 'Undo' }).first().click();
	await expect(
		page.locator('section').filter({ hasText: 'Recently done' }),
	).toHaveCount(0);
	await expect(
		page.locator('section').filter({ hasText: 'Overdue' }).first(),
	).toContainText(label.trim());
});

test('something sown in a bed shows up with a harvest estimate', async ({
	page,
}) => {
	await page.goto('/garden/bed-1');
	// The bed starts with nothing in it. The plan's own cells no longer carry
	// the word "empty" - a grid full of it made the page look switched off -
	// so this asks the "Growing here now" list instead.
	await expect(page.getByText('Empty.', { exact: true })).toBeVisible();

	await page.getByLabel('What').selectOption({ label: 'Tomato' });
	await page.getByRole('button', { name: 'Sow', exact: true }).click();

	// Sown 25 September, 70-90 days: December.
	const growing = page.locator('section').filter({ hasText: 'Growing here now' });
	await expect(growing).toContainText('Tomato');
	await expect(growing).toContainText('ready about');
	await expect(growing).toContainText('December 2026');

	// And the rotation warning now knows this family has been here - said
	// before you press the button, not after.
	const sowForm = page.locator('form').filter({ has: page.getByLabel('What') });
	await page.getByLabel('What').selectOption({ label: 'Tomato' });
	await expect(sowForm.getByText(/Solanaceae/)).toBeVisible();
	await expect(sowForm.getByText(/invites trouble/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Sow it anyway' })).toBeVisible();
});

test('every page carries the security headers and breaks none of its own policy', async ({
	page,
}) => {
	const violations: string[] = [];
	page.on('console', (message) => {
		if (
			/Content Security Policy|Refused to (load|execute|apply)/i.test(
				message.text(),
			)
		) {
			violations.push(message.text());
		}
	});

	for (const path of [
		'/now',
		'/grid',
		'/garden',
		'/plants',
		'/plants/lemon',
		'/settings',
		'/ask',
	]) {
		const response = await page.goto(path);
		const headers = response?.headers() ?? {};
		expect(headers['content-security-policy'], path).toMatch(
			/script-src 'self' 'nonce-/,
		);
		expect(headers['x-frame-options'], path).toBe('DENY');
		expect(headers['x-content-type-options'], path).toBe('nosniff');
		expect(headers['x-powered-by'], path).toBeUndefined();
		// Next only sets this once its scripts have run - which they do only if
		// the nonce reached them.
		await expect
			.poll(() => page.evaluate(() => typeof (window as { next?: unknown }).next), {
				message: path,
			})
			.toBe('object');
	}
	expect(violations).toEqual([]);
});
