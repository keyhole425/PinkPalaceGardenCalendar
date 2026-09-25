/**
 * Applies any pending migrations from db/migrations, creating the database
 * file and its directory if this is the first run.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const file =
	process.env.GARDEN_DB_PATH ?? path.join(process.cwd(), 'data', 'garden.db');

fs.mkdirSync(path.dirname(file), { recursive: true });

const sqlite = new Database(file);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

migrate(drizzle(sqlite), { migrationsFolder: './db/migrations' });
sqlite.close();

console.log(`figgy: migrations applied to ${file}`);
