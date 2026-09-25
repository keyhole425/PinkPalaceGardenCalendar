/**
 * A throwaway database for tests.
 *
 * Points GARDEN_DB_PATH at a temp file and re-imports the modules that read
 * it, so tests exercise the real query and action code rather than a parallel
 * implementation of it.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

export type TempGarden = {
	file: string;
	cleanup: () => void;
};

/** Creates an empty, migrated database and makes it the one modules will open. */
export function createTempGarden(): TempGarden {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figgy-test-'));
	const file = path.join(dir, 'garden.db');

	const sqlite = new Database(file);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	migrate(drizzle(sqlite), { migrationsFolder: './db/migrations' });
	sqlite.close();

	process.env.GARDEN_DB_PATH = file;

	return {
		file,
		cleanup: () => {
			process.env.GARDEN_DB_PATH = undefined;
			fs.rmSync(dir, { recursive: true, force: true });
		},
	};
}
