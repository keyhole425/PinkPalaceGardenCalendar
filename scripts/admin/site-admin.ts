/**
 * Grants or revokes site admin: the right to start new gardens.
 *
 *   npm run admin:grant -- them@example.com
 *   npm run admin:revoke -- them@example.com
 *
 * Deliberately not something the app can do. The app reads the flag from the
 * database on every check, so a revoke takes effect on the next request.
 */
import { eq } from 'drizzle-orm';
import { db, dbUrl, describeDbUrl } from '@/lib/db/client';
import { user } from '@/lib/db/schema';

async function main() {
	const [mode, email] = process.argv.slice(2);
	if ((mode !== 'grant' && mode !== 'revoke') || !email) {
		throw new Error('Usage: site-admin.ts grant|revoke <email>');
	}
	const updated = await db
		.update(user)
		.set({ siteAdmin: mode === 'grant' })
		.where(eq(user.email, email.trim().toLowerCase()))
		.returning({ email: user.email })
		.get();
	db.$client.close();
	if (!updated) throw new Error(`Nobody has the address ${email}.`);
	console.log(
		`figgy: ${updated.email} ${mode === 'grant' ? 'is now' : 'is no longer'} a site admin on ${describeDbUrl(dbUrl)}.`,
	);
}

main().catch((error) => {
	console.error(`figgy: ${error instanceof Error ? error.message : error}`);
	process.exit(1);
});
