import path from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * Three smoke flows against the real production server.
 *
 * It runs a production build under `next start` rather than the dev server,
 * so the tests exercise what actually ships. The database is a throwaway
 * seeded fresh on every run.
 */
// Playwright loads this as CommonJS, so no import.meta here.
const root = process.cwd();
const db = path.join(root, 'data', 'e2e.db');

const serve = [
	`rm -f ${db} ${db}-wal ${db}-shm`,
	'npm run build',
	'npm run db:migrate',
	'npm run db:seed',
	'npx next start -H 127.0.0.1 -p 3100',
].join(' && ');

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://127.0.0.1:3100',
		trace: 'retain-on-failure',
	},
	webServer: {
		command: serve,
		url: 'http://127.0.0.1:3100/api/health',
		reuseExistingServer: false,
		timeout: 180_000,
		env: {
			GARDEN_DB_PATH: db,
			// Pinned, so "what's due" is the same on every run.
			FIGGY_TODAY: '2026-09-25',
		},
	},
});
