/** Every household and who is in it: `npm run admin:list`. */
import { asc, eq } from 'drizzle-orm';
import { db, dbUrl, describeDbUrl } from '@/lib/db/client';
import { household, membership, user } from '@/lib/db/schema';

async function main() {
	const homes = await db.select().from(household).orderBy(asc(household.id)).all();
	const people = await db
		.select({
			householdId: membership.householdId,
			role: membership.role,
			name: user.name,
			email: user.email,
			siteAdmin: user.siteAdmin,
		})
		.from(membership)
		.innerJoin(user, eq(membership.userId, user.id))
		.all();
	db.$client.close();

	console.log(`figgy on ${describeDbUrl(dbUrl)}`);
	for (const home of homes) {
		console.log(`\n${home.id}  ${home.name} (${home.seedProfile})`);
		const here = people.filter((p) => p.householdId === home.id);
		if (here.length === 0) console.log('    nobody yet');
		for (const p of here) {
			console.log(
				`    ${p.role.padEnd(6)} ${p.name} <${p.email}>${p.siteAdmin ? '  site admin' : ''}`,
			);
		}
	}
}

main().catch((error) => {
	console.error(`figgy: ${error instanceof Error ? error.message : error}`);
	process.exit(1);
});
