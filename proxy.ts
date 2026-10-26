/**
 * Runs before every page: sets the Content-Security-Policy, and sends anyone
 * without a session cookie to sign in.
 *
 * The redirect is a courtesy, not the lock. It only checks that a cookie
 * exists - not that it is valid - and it can be skipped by anything the
 * matcher leaves out. The lock is requireHousehold(), which every page and
 * every server action calls for itself.
 *
 * The policy is nonce-based: Next.js reads the nonce from the request's own
 * CSP header and puts it on the scripts it writes, so only those run. Every
 * page is rendered per request, which is what makes a per-request nonce work.
 */
import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

/** Pages a stranger may see: signing in, and spending an invite. */
const OPEN = [/^\/login$/, /^\/join\//];

function policy(nonce: string): string {
	const dev = process.env.NODE_ENV !== 'production';
	return [
		"default-src 'self'",
		// React's development build evaluates code for its error overlay.
		`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
		// Next and React set style attributes inline; nothing here is user-supplied CSS.
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		"font-src 'self'",
		// Claude, the Bureau and Open-Meteo are all called from the server.
		"connect-src 'self'",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"object-src 'none'",
		// Hosted only: the e2e suite serves a production build over plain http.
		...(process.env.VERCEL ? ['upgrade-insecure-requests'] : []),
	].join('; ');
}

export function proxy(request: NextRequest) {
	const { pathname, search } = request.nextUrl;

	if (!OPEN.some((path) => path.test(pathname)) && !getSessionCookie(request)) {
		const login = new URL('/login', request.url);
		if (pathname !== '/') login.searchParams.set('next', pathname + search);
		return NextResponse.redirect(login);
	}

	const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
	const csp = policy(nonce);
	const headers = new Headers(request.headers);
	headers.set('x-nonce', nonce);
	headers.set('Content-Security-Policy', csp);

	const response = NextResponse.next({ request: { headers } });
	response.headers.set('Content-Security-Policy', csp);
	return response;
}

export const config = {
	matcher: [
		{
			// Every page, but not Better Auth's endpoints, the health check, or
			// what a browser or a home screen fetches on its own.
			source:
				'/((?!api/|_next/static|_next/image|manifest.webmanifest|icon.svg|favicon.ico|robots.txt).*)',
			// Prefetches carry no page of their own to protect.
			missing: [
				{ type: 'header', key: 'next-router-prefetch' },
				{ type: 'header', key: 'purpose', value: 'prefetch' },
			],
		},
	],
};
