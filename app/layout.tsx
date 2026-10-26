import type { Metadata, Viewport } from 'next';
import { figgyMono, figgySans, figgySerif } from './fonts';
import './globals.css';

/**
 * Every page per request, the not-found page included. The CSP in proxy.ts
 * carries a fresh nonce each time, and a page built ahead of time would have
 * scripts with no nonce at all - which the policy would then refuse to run.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
	title: 'figgy',
	description: 'A garden calendar: what is due, what you did, what grows where.',
	appleWebApp: { capable: true, title: 'figgy', statusBarStyle: 'default' },
	icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	themeColor: '#eec9de',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html
			lang="en-AU"
			className={`${figgySans.variable} ${figgySerif.variable} ${figgyMono.variable}`}
		>
			<body className="min-h-dvh">{children}</body>
		</html>
	);
}
