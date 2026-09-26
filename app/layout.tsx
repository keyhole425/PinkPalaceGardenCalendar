import type { Metadata, Viewport } from 'next';
import { SiteHeader, TabBar } from '@/components/shell/SiteHeader';
import { figgyMono, figgySans, figgySerif } from './fonts';
import './globals.css';

export const metadata: Metadata = {
	title: 'figgy',
	description: 'The Pink Palace garden calendar',
	appleWebApp: { capable: true, title: 'figgy', statusBarStyle: 'default' },
	icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	themeColor: '#fec6d3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html
			lang="en-AU"
			className={`${figgySans.variable} ${figgySerif.variable} ${figgyMono.variable}`}
		>
			<body className="min-h-dvh">
				<a
					href="#main"
					className="sr-only rounded-md bg-paper px-4 py-2 text-palace-700 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
				>
					Skip to content
				</a>
				<SiteHeader />
				{/*
				 * No width here on purpose. A reading page and a twelve-month
				 * table want very different things, so each page declares its
				 * own Frame.
				 */}
				<main id="main" className="pt-6 pb-20 sm:pb-10">
					{children}
				</main>
				<TabBar />
			</body>
		</html>
	);
}
