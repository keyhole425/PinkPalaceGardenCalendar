/**
 * Signing in.
 *
 * Better Auth handles passwords, sessions and the rate limit. figgy handles
 * who gets an account at all: sign-up is switched off here, and the only way
 * an account is made is lib/invites.ts, from an invite somebody was allowed to
 * mint. That is also why there is no "forgot password" email - a reset is an
 * invite too, minted from the command line.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';

/** Where figgy is being served from, for cookies and origin checks. */
export function baseUrl(): string {
	if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
	// Preview deployments each have their own address.
	if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
	return 'http://localhost:3000';
}

function secret(): string | undefined {
	const value = process.env.BETTER_AUTH_SECRET;
	// Better Auth signs sessions with a well-known default when this is unset.
	// That is fine for a laptop and nowhere else.
	if (!value && process.env.VERCEL) {
		throw new Error('BETTER_AUTH_SECRET is not set.');
	}
	return value;
}

export const MIN_PASSWORD_LENGTH = 12;

export const auth = betterAuth({
	appName: 'figgy',
	baseURL: baseUrl(),
	secret: secret(),
	trustedOrigins: [
		baseUrl(),
		...(process.env.VERCEL_BRANCH_URL
			? [`https://${process.env.VERCEL_BRANCH_URL}`]
			: []),
	],
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
			rateLimit: schema.rateLimit,
		},
	}),
	emailAndPassword: {
		enabled: true,
		// Accounts come from invites, never from a form anyone can find.
		disableSignUp: true,
		minPasswordLength: MIN_PASSWORD_LENGTH,
		maxPasswordLength: 128,
	},
	user: {
		additionalFields: {
			// Never settable through the API; see scripts/admin.
			siteAdmin: { type: 'boolean', defaultValue: false, input: false },
		},
	},
	session: {
		// A phone in the garden should not be asked for a password every week.
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24,
		// Saves a database read on every page. Roles are not taken from it:
		// lib/auth/context.ts reads those fresh each time.
		cookieCache: { enabled: true, maxAge: 5 * 60 },
	},
	rateLimit: {
		// On everywhere, development included, so the limit that guards
		// production is the one the tests run against.
		enabled: true,
		// Serverless memory does not last between requests.
		storage: 'database',
		window: 60,
		max: 100,
		customRules: {
			'/sign-in/email': { window: 60, max: 5 },
		},
	},
	advanced: {
		ipAddress: {
			// Vercel's own header first: it cannot be set by the client.
			ipAddressHeaders: ['x-vercel-forwarded-for', 'x-forwarded-for'],
		},
	},
	telemetry: { enabled: false },
	// Must be last: it is what lets a server action set the session cookie.
	plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
