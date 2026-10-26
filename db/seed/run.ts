import { db } from '@/lib/db/client';
import { seedGarden } from './seed';

async function main() {
	const report = await seedGarden(db);
	db.$client.close();

	console.log(
		[
			`figgy seed ${report.version}`,
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

main().catch((error) => {
	console.error('figgy: seeding failed:', error);
	process.exit(1);
});
