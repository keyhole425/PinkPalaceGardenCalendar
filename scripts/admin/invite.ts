/**
 * Mints an invite from the command line, against whatever database
 * TURSO_DATABASE_URL points at. This is how the first person gets in, and the
 * only way a site admin is made (see grant.ts).
 *
 *   npm run admin:invite -- --new-garden [--email them@example.com]
 *   npm run admin:invite -- --household 1 [--role admin] [--email ...]
 *   npm run admin:invite -- --reset them@example.com
 *
 * Links are built from BETTER_AUTH_URL, so set it to the live address when
 * minting for the live site.
 */
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { db, dbUrl, describeDbUrl } from '@/lib/db/client';
import { household, user } from '@/lib/db/schema';
import { asHouseholdId } from '@/lib/db/tenancy';
import { mintInvite } from '@/lib/invites';

async function main() {
	const { values } = parseArgs({
		options: {
			'new-garden': { type: 'boolean' },
			household: { type: 'string' },
			role: { type: 'string' },
			email: { type: 'string' },
			reset: { type: 'string' },
		},
	});

	let minted: Awaited<ReturnType<typeof mintInvite>>;
	let what: string;

	if (values.reset) {
		const person = await db
			.select({ id: user.id, email: user.email })
			.from(user)
			.where(eq(user.email, values.reset.trim().toLowerCase()))
			.get();
		if (!person) throw new Error(`Nobody has the address ${values.reset}.`);
		minted = await mintInvite({ kind: 'reset_password', userId: person.id });
		what = `a new password for ${person.email}`;
	} else if (values['new-garden']) {
		minted = await mintInvite({ kind: 'new_household', email: values.email });
		what = 'a new garden';
	} else if (values.household) {
		const home = await db
			.select({ id: household.id, name: household.name })
			.from(household)
			.where(eq(household.id, Number(values.household)))
			.get();
		if (!home) throw new Error(`There is no household ${values.household}.`);
		const role = values.role === 'admin' ? 'admin' : 'member';
		minted = await mintInvite({
			kind: 'join_household',
			householdId: asHouseholdId(home.id),
			role,
			email: values.email,
		});
		what = `joining ${home.name} as ${role === 'admin' ? 'an admin' : 'a member'}`;
	} else {
		throw new Error(
			'Say what for: --new-garden, --household <id> or --reset <email>.',
		);
	}

	db.$client.close();
	console.log(
		[
			`figgy: an invite for ${what}, on ${describeDbUrl(dbUrl)}.`,
			`Good once, until ${minted.expiresAt.slice(0, 16).replace('T', ' ')} UTC:`,
			'',
			`  ${minted.url}`,
			'',
			'It is shown this once and kept nowhere. Send it to them directly.',
		].join('\n'),
	);
}

main().catch((error) => {
	console.error(`figgy: ${error instanceof Error ? error.message : error}`);
	process.exit(1);
});
