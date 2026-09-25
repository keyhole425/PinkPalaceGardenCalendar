import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	// One self-contained server.js for the container, rather than the whole
	// node_modules tree.
	output: 'standalone',
	// better-sqlite3 is a native module; bundling it breaks the binding.
	serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
