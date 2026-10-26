import { expect, test as setup } from '@playwright/test';
import { GARDENER, SIGNED_IN } from './fixtures';

setup('sign in once', async ({ page }) => {
	await page.goto('/now');
	await expect(page).toHaveURL(/\/login/);

	await page.getByLabel('Email').fill(GARDENER.email);
	await page.getByLabel('Password').fill(GARDENER.password);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page).toHaveURL(/\/now/);
	await page.context().storageState({ path: SIGNED_IN });
});
