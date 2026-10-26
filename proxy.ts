/**
 * Sends anyone without a session cookie to sign in, before a page renders.
 *
 * This is a courtesy, not the lock. It only checks that a cookie exists -
 * not that it is valid - and it can be skipped by anything the matcher
 * leaves out. The lock is requireHousehold(), which every page and every
 * server action calls for itself.
 */
import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
	if (getSessionCookie(request)) return NextResponse.next();

	const login = new URL('/login', request.url);
	const { pathname, search } = request.nextUrl;
	if (pathname !== '/') login.searchParams.set('next', pathname + search);
	return NextResponse.redirect(login);
}

export const config = {
	// Everything but sign-in itself, invites, Better Auth's endpoints, the
	// health check, and what a browser or a home screen fetches on its own.
	matcher: [
		'/((?!api/|_next/static|_next/image|login|join/|manifest.webmanifest|icon.svg|favicon.ico|robots.txt).*)',
	],
};
