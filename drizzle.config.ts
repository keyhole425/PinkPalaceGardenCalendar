import path from 'node:path';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'sqlite',
	schema: './lib/db/schema.ts',
	out: './db/migrations',
	dbCredentials: {
		url:
			process.env.GARDEN_DB_PATH ?? path.join(process.cwd(), 'data', 'garden.db'),
	},
	strict: true,
	verbose: true,
});
