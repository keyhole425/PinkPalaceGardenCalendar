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

// Next.js reloads modules on every edit in development, which would otherwise
// open a new connection each time. The cache is deliberately limited to
// development: under test it would outlive the module reset that gives each
// test its own database, and every test would quietly share the first one.
const globalForDb = globalThis as unknown as { figgyDb?: Db };
const cacheConnection = process.env.NODE_ENV === 'development';

export const db =
	(cacheConnection ? globalForDb.figgyDb : undefined) ?? createDb(resolveDbPath());

if (cacheConnection) {
	globalForDb.figgyDb = db;
}

export { schema };
export const dbPath = resolveDbPath();
