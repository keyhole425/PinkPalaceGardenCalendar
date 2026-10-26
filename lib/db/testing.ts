/**
 * A throwaway database for tests.
 *
 * Points TURSO_DATABASE_URL at a temp file and re-imports the modules that
 * read it, so tests exercise the real query and action code rather than a
 * parallel implementation of it.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createDb } from './client';

export type TempGarden = {
	file: string;
	cleanup: () => void;
};

/** Creates an empty, migrated database and makes it the one modules will open. */
export async function createTempGarden(): Promise<TempGarden> {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figgy-test-'));
	const file = path.join(dir, 'garden.db');
	const url = `file:${file}`;

	const db = createDb(url);
	await migrate(db, { migrationsFolder: './db/migrations' });
	db.$client.close();

	process.env.TURSO_DATABASE_URL = url;

	return {
		file,
		cleanup: () => {
			// Deliberately not unset: vitest.setup.ts points it at a throwaway
			// file for the whole run, and leaving it pointing there keeps the
			// real garden out of reach even between tests.
			fs.rmSync(dir, { recursive: true, force: true });
		},
	};
}
