import type { NextConfig } from 'next';

/**
 * Headers every response carries. The Content-Security-Policy is not here:
 * it needs a fresh nonce per request, so proxy.ts sets it.
 */
const SECURITY_HEADERS = [
	// Two years, but only when hosted. Sent from localhost, a browser would
	// refuse plain http there for two years - every other project included.
	...(process.env.VERCEL
		? [
				{
					key: 'Strict-Transport-Security',
					value: 'max-age=63072000; includeSubDomains',
				},
			]
		: []),
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	// No framing at all; CSP's frame-ancestors says the same for newer browsers.
	{ key: 'X-Frame-Options', value: 'DENY' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	{
		key: 'Permissions-Policy',
		value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
	},
];

const nextConfig: NextConfig = {
	poweredByHeader: false,
	async headers() {
		return [
			{ source: '/:path*', headers: SECURITY_HEADERS },
			// An invite's token is in its address. Never pass it on.
			{
				source: '/join/:path*',
				headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
			},
		];
	},
};

export default nextConfig;
