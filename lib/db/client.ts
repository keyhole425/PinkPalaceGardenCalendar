/**
 * The database handle.
 *
 * libSQL: Turso when TURSO_DATABASE_URL names one, a local SQLite file when it
 * does not. Both speak the same dialect and run the same migrations, so
 * development and the tests work against a file and production against Turso
 * without the code knowing which.
 *
 * Every query is async. Turso is across a network, and even the local file is
 * opened through the same client so that nothing works locally that would not
 * work hosted.
 *
 * Nothing here may rely on a foreign-key cascade. The local driver enforces
 * foreign keys, but whether a hosted connection does is down to Turso, not to
 * figgy - so anything that has to follow a delete is done in code, where the
 * file and the hosted database are bound to behave the same.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;
/** A transaction, which every write helper accepts in place of the database. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function resolveDbUrl(): string {
	return (
		process.env.TURSO_DATABASE_URL ??
		`file:${path.join(process.cwd(), 'data', 'garden.db')}`
	);
}

/**
 * Where the database is, safe to show: the host for Turso, the path for a
 * file. Never the token.
 */
export function describeDbUrl(url: string): string {
	if (url.startsWith('file:')) return url.slice('file:'.length);
	try {
		return new URL(url).host;
	} catch {
		return 'unknown';
	}
}

/** Opens a database at a libSQL URL, creating a local file's directory if need be. */
export function createDb(url: string, authToken?: string) {
	// The tests promise never to touch a real garden. A hosted URL under
	// vitest would break that promise across the network, so it is refused
	// outright rather than trusted to be a test database.
	if (process.env.VITEST && !url.startsWith('file:')) {
		throw new Error(`Tests may only open a local file, not ${describeDbUrl(url)}.`);
	}
	// On Vercel a local file lives on a disk that is thrown away between
	// requests. Better to fail loudly than to lose writes quietly.
	if (process.env.VERCEL && url.startsWith('file:')) {
		throw new Error(
			'TURSO_DATABASE_URL is not set, and Vercel has no disk to keep a file on.',
		);
	}
	if (url.startsWith('file:')) {
		fs.mkdirSync(path.dirname(url.slice('file:'.length)), { recursive: true });
	}
	return drizzle(createClient({ url, authToken }), { schema });
}

// Next.js reloads modules on every edit in development, which would otherwise
// open a new connection each time. The cache is deliberately limited to
// development: under test it would outlive the module reset that gives each
// test its own database, and every test would quietly share the first one.
const globalForDb = globalThis as unknown as { figgyDb?: Db };
const cacheConnection = process.env.NODE_ENV === 'development';

export const dbUrl = resolveDbUrl();

export const db =
	(cacheConnection ? globalForDb.figgyDb : undefined) ??
	createDb(dbUrl, process.env.TURSO_AUTH_TOKEN);

if (cacheConnection) {
	globalForDb.figgyDb = db;
}
