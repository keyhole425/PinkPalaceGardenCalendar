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
