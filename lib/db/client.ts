/**
 * The database handle.
 *
 * SQLite in WAL mode, one file, opened once per process. Reads are synchronous,
 * which is what lets server components query straight through without an
 * async boundary.
 */
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

function resolveDbPath(): string {
	const configured = process.env.GARDEN_DB_PATH;
	if (configured) return configured;
	return path.join(process.cwd(), 'data', 'garden.db');
}

function open() {
	const file = resolveDbPath();
	const sqlite = new Database(file);
	// WAL lets a reader and a writer coexist; foreign keys are off by default
	// in SQLite and have to be asked for on every connection.
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	return drizzle(sqlite, { schema });
}

// Next.js reloads modules in development; without this the process would open
// a new connection on every edit.
const globalForDb = globalThis as unknown as {
	figgyDb?: ReturnType<typeof open>;
};

export const db = globalForDb.figgyDb ?? open();

if (process.env.NODE_ENV !== 'production') {
	globalForDb.figgyDb = db;
}

export { schema };
export const dbPath = resolveDbPath();
