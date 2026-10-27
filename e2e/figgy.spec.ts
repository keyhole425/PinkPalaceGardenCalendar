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

test('a place is added at its own size, changed, and removed', async ({ page }) => {
	await page.goto('/garden');
	await page.getByRole('link', { name: 'Add a place' }).click();

	await page.getByLabel('Name', { exact: true }).fill('Herb bed');
	await page
		.getByLabel('Kind')
		.selectOption({ label: 'Raised bed — built up, annuals' });
	await page.getByLabel('Across').fill('3');
	await page.getByLabel('Deep').fill('3');
	await expect(page.getByText('9 spots, 3 across and 3 deep.')).toBeVisible();
	await page.getByRole('button', { name: 'Add it' }).click();

	await expect(page).toHaveURL(/\/garden\/herb-bed$/);
	await expect(page.getByText('3 × 3 spots')).toBeVisible();

	await page.getByRole('link', { name: 'Change' }).click();
	await page.getByLabel('Name', { exact: true }).fill('Kitchen herbs');
	await page.getByLabel('Across').fill('2');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved.')).toBeVisible();

	await page.goto('/garden');
	const herbs = page.locator('section').filter({ hasText: 'Kitchen herbs' });
	await expect(herbs).toContainText('0 of 6 spots');

	await page.goto('/garden/herb-bed/edit');
	await page.getByText('Remove', { exact: true }).click();
	await page.getByRole('button', { name: 'Remove Kitchen herbs' }).click();
	await expect(page).toHaveURL(/\/garden$/);
	await expect(page.getByText('Kitchen herbs')).toHaveCount(0);
});

test("a site admin sees the garden's housekeeping numbers", async ({ page }) => {
	await page.goto('/settings');
	await expect(
		page.getByRole('heading', { name: 'This garden in figgy' }),
	).toBeVisible();
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

test('a plant is looked up, added, sown, and found again from its bed', async ({
	page,
}) => {
	await page.goto('/plants');
	await page.getByLabel('Look up a plant').fill('chilli');
	await page.getByRole('button', { name: 'Look up' }).click();
	await expect(
		page.getByRole('heading', { name: 'Matching “chilli”' }),
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Habanero' })).toBeVisible();

	await page.getByRole('link', { name: 'Chilli', exact: true }).click();
	await expect(
		page.getByRole('heading', { name: 'Chilli', level: 1 }),
	).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Kinds of chilli' }),
	).toBeVisible();

	await page.getByRole('button', { name: 'Add to my garden' }).click();
	await expect(page.getByText('Added to your plants.')).toBeVisible();
	await page.getByRole('button', { name: 'Sow it' }).click();
	await expect(page.getByText(/^Sown/)).toBeVisible();

	// The bed's own plan now opens the plant, at that planting.
	await page.goto('/garden/hothouse');
	await page.getByRole('link', { name: /^Chilli in column/ }).click();
	await expect(page).toHaveURL(/\/plants\/chilli#planting-\d+$/);
	await expect(page.getByRole('heading', { name: 'Your garden' })).toBeVisible();
});

test('a search that finds nothing offers to look it up', async ({ page }) => {
	await page.goto('/plants?q=dragon+fruit');
	await expect(
		page.getByText('figgy doesn’t know “dragon fruit” yet.'),
	).toBeVisible();
	await page.getByRole('link', { name: 'Let figgy look it up' }).click();
	await expect(page).toHaveURL(/\/plants\/new\?q=dragon%20fruit/);
});
