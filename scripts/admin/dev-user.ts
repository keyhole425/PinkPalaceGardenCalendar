/**
 * A person to sign in as, for development and the e2e suite only.
 *
 *   FIGGY_DEV_EMAIL=you@example.com FIGGY_DEV_PASSWORD='a long one' npm run admin:dev-user
 *
 * Makes them an admin of household 1 (seeding it if need be) and a site
 * admin, through an invite like anyone else. Refuses anything but a local
 * database file: a hosted figgy gets its first person from admin:invite.
 */
import { eq } from 'drizzle-orm';
import { seedGarden } from '@/db/seed/seed';
import { db, dbUrl } from '@/lib/db/client';
import { user } from '@/lib/db/schema';
import { createAccountFromInvite, mintInvite } from '@/lib/invites';

async function main() {
	if (!dbUrl.startsWith('file:') || process.env.VERCEL) {
		throw new Error('dev-user only works on a local database file.');
	}
	const email = process.env.FIGGY_DEV_EMAIL?.trim().toLowerCase();
	const password = process.env.FIGGY_DEV_PASSWORD;
	if (!email || !password) {
		throw new Error('Set FIGGY_DEV_EMAIL and FIGGY_DEV_PASSWORD.');
	}

	const existing = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, email))
		.get();
	if (!existing) {
		const { householdId } = await seedGarden(db);
		const minted = await mintInvite({
			kind: 'join_household',
			householdId,
			role: 'admin',
		});
		const spent = await createAccountFromInvite(
			minted.url.split('/join/')[1] ?? '',
			{
				name: process.env.FIGGY_DEV_NAME ?? 'Gardener',
				email,
				password,
			},
		);
		if (!spent.ok) throw new Error(spent.error);
	}
	await db.update(user).set({ siteAdmin: true }).where(eq(user.email, email)).run();
	db.$client.close();
	console.log(
		`figgy: ${email} can sign in, as an admin of household 1 and a site admin.`,
	);
}

main().catch((error) => {
	console.error(`figgy: ${error instanceof Error ? error.message : error}`);
	process.exit(1);
});
