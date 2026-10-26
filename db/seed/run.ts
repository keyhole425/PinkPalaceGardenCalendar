/**
 * `npm run db:seed`: brings every household up to date with its profile.
 * An empty database gets the Pink Palace, so development has a garden.
 */
import { db } from '@/lib/db/client';
import { seedAll } from './seed';

async function main() {
	const reports = await seedAll(db);
	db.$client.close();

	for (const report of reports) {
		console.log(
			[
				`figgy seed ${report.version}, household ${report.householdId}`,
				`  environments created: ${report.environments}`,
				`  plant types created:  ${report.plantTypes}`,
				`  plantings created:    ${report.plantings}`,
				`  rules written:        ${report.rules}`,
				report.leftAlone.length > 0
					? `  yours, left alone:    ${report.leftAlone.join(', ')}`
					: '  yours, left alone:    none',
			].join('\n'),
		);
	}
}

main().catch((error) => {
	console.error('figgy: seeding failed:', error);
	process.exit(1);
});
