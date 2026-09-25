import { db } from '@/lib/db/client';
import { seedGarden } from './seed';

const report = seedGarden(db);

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
