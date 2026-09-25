import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		// Mirrors the "@/*" path alias from tsconfig.json.
		alias: { '@': path.resolve(import.meta.dirname, '.') },
	},
	test: {
		environment: 'node',
		include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
		// Must run before any test module is imported: see the file.
		setupFiles: ['./vitest.setup.ts'],
	},
});
