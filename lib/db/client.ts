/**
 * The database handle.
 *
 * SQLite in WAL mode, one file, opened once per process. Reads are synchronous,
 * which is what lets server components query straight through without an async
 * boundary.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;

export function resolveDbPath(): string {
	return (
		process.env.GARDEN_DB_PATH ?? path.join(process.cwd(), 'data', 'garden.db')
	);
}

/** Opens a database at a given path. Tests use this against a temp file. */
export function createDb(file: string) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const sqlite = new Database(file);
	// WAL lets a reader and a writer coexist; foreign keys are off by default
	// in SQLite and have to be asked for on every connection.
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	return drizzle(sqlite, { schema });
}

// Next.js reloads modules in development; without this the process would open
// a new connection on every edit.
const globalForDb = globalThis as unknown as { figgyDb?: Db };

export const db = globalForDb.figgyDb ?? createDb(resolveDbPath());

if (process.env.NODE_ENV !== 'production') {
	globalForDb.figgyDb = db;
}

export { schema };
export const dbPath = resolveDbPath();
