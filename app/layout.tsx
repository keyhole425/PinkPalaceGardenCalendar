import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
	title: 'figgy',
	description: 'The Pink Palace garden calendar',
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	themeColor: '#fec6d3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en-AU">
			<body className="min-h-dvh">
				<header className="border-palace-300 border-b bg-palace-200">
					<nav className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-2">
						<Link href="/" className="font-semibold text-palace-700 text-lg">
							figgy
						</Link>
						<Link href="/now" className="text-ink text-sm hover:text-palace-700">
							What&rsquo;s on
						</Link>
						<Link href="/grid" className="text-ink text-sm hover:text-palace-700">
							The year
						</Link>
						<Link href="/plants" className="text-ink text-sm hover:text-palace-700">
							Plants
						</Link>
						<Link
							href="/environments"
							className="text-ink text-sm hover:text-palace-700"
						>
							Places
						</Link>
					</nav>
				</header>
				<main className="mx-auto max-w-[1400px] px-4 py-6">{children}</main>
			</body>
		</html>
	);
}
