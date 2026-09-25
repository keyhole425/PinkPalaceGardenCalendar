import path from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * Three smoke flows against the real production server.
 *
 * It runs the standalone build - the same thing the container runs - rather
 * than the dev server, so the tests exercise what actually ships. The database
 * is a throwaway seeded fresh on every run, and the path is absolute because
 * the standalone server runs from its own directory.
 */
// Playwright loads this as CommonJS, so no import.meta here.
const root = process.cwd();
const db = path.join(root, 'data', 'e2e.db');
const standalone = path.join(root, '.next', 'standalone');

const serve = [
	`rm -f ${db} ${db}-wal ${db}-shm`,
	'npm run build',
	'npm run db:migrate',
	'npm run db:seed',
	// The standalone output does not include static assets; the Dockerfile
	// copies them the same way.
	`cp -r ${path.join(root, 'public')} ${standalone}/`,
	`mkdir -p ${standalone}/.next && cp -r ${path.join(root, '.next', 'static')} ${standalone}/.next/`,
	`node ${standalone}/server.js`,
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
			PORT: '3100',
			HOSTNAME: '127.0.0.1',
			// Pinned, so "what's due" is the same on every run.
			FIGGY_TODAY: '2026-09-25',
		},
	},
});
