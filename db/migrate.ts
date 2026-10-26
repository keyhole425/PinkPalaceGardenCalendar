/**
 * Applies any pending migrations from db/migrations, creating the database
 * file and its directory if this is a local first run.
 *
 * Run deliberately - by hand or from CI - never on a cold start: a hosted
 * function that migrates on boot races every other instance doing the same.
 */
import { migrate } from 'drizzle-orm/libsql/migrator';
import { db, dbUrl, describeDbUrl } from '@/lib/db/client';

async function main() {
	await migrate(db, { migrationsFolder: './db/migrations' });
	db.$client.close();
	console.log(`figgy: migrations applied to ${describeDbUrl(dbUrl)}`);
}

main().catch((error) => {
	console.error('figgy: migration failed:', error);
	process.exit(1);
});
