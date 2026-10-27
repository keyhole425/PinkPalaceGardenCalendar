/**
 * The e2e suite's own throwaway values. None of them is a real credential:
 * the database is deleted and rebuilt on every run, and the secret signs
 * sessions on 127.0.0.1 only.
 */
import path from 'node:path';

// Playwright loads its config as CommonJS, so no import.meta here.
export const ROOT = process.cwd();
export const E2E_DB = path.join(ROOT, 'data', 'e2e.db');
export const E2E_URL = 'http://127.0.0.1:3100';

export const GARDENER = {
	email: 'gardener@figgy.test',
	password: 'a long e2e password',
	name: 'Gardener',
};

export const E2E_ENV = {
	TURSO_DATABASE_URL: `file:${E2E_DB}`,
	BETTER_AUTH_URL: E2E_URL,
	BETTER_AUTH_SECRET: 'e2e-only-secret-that-signs-nothing-real-0000',
	// Production refuses to run without one, and the library's anonymous
	// keys are made with it. The bytes spell e2e-only-encryption-key-00000000.
	FIGGY_ENCRYPTION_KEY: 'ZTJlLW9ubHktZW5jcnlwdGlvbi1rZXktMDAwMDAwMDA=',
	// Pinned, so "what's due" is the same on every run.
	FIGGY_TODAY: '2026-09-25',
};

export const SIGNED_IN = path.join(ROOT, 'e2e', '.auth', 'gardener.json');
