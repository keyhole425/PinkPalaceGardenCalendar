import { defineConfig } from '@playwright/test';
import { E2E_DB, E2E_ENV, E2E_URL, GARDENER, SIGNED_IN } from './e2e/fixtures';

/**
 * Smoke flows against the real production server.
 *
 * It runs a production build under `next start` rather than the dev server,
 * so the tests exercise what actually ships. The database is a throwaway
 * seeded fresh on every run, with one gardener who can sign in; the setup
 * project signs in once and the rest reuse the session, because the login
 * rate limit is on here exactly as it is in production.
 */
const serve = [
	`rm -f ${E2E_DB} ${E2E_DB}-wal ${E2E_DB}-shm`,
	'npm run build',
	'npm run db:migrate',
	'npm run db:seed',
	'npm run admin:dev-user',
	'npx next start -H 127.0.0.1 -p 3100',
].join(' && ');

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: E2E_URL,
		trace: 'retain-on-failure',
	},
	projects: [
		{ name: 'setup', testMatch: /.*\.setup\.ts/ },
		{
			name: 'signed in',
			testMatch: /figgy\.spec\.ts/,
			dependencies: ['setup'],
			use: { storageState: SIGNED_IN },
		},
		{
			// Each test here brings its own browser context, signed in or not.
			name: 'getting in',
			testMatch: /access\.spec\.ts/,
			dependencies: ['setup'],
		},
	],
	webServer: {
		command: serve,
		url: `${E2E_URL}/api/health`,
		reuseExistingServer: false,
		timeout: 240_000,
		env: {
			...E2E_ENV,
			FIGGY_DEV_EMAIL: GARDENER.email,
			FIGGY_DEV_PASSWORD: GARDENER.password,
			FIGGY_DEV_NAME: GARDENER.name,
		},
	},
});
