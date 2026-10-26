import path from 'node:path';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'sqlite',
	schema: './lib/db/schema.ts',
	out: './db/migrations',
	// Studio browses the local file. The hosted database has Turso's own
	// shell; migrations reach it through `npm run db:migrate`, not drizzle-kit.
	dbCredentials: {
		url: path.join(process.cwd(), 'data', 'garden.db'),
	},
	strict: true,
	verbose: true,
});
