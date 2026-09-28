import Link from 'next/link';
import { Frame } from '@/components/ui/Frame';
import { Icon } from '@/components/ui/Icon';
import { ROUTES, TABS } from '@/lib/nav';
import { NavLink, TabLink } from './NavLink';

/** The notebook's pink cover: the one place saturated pink belongs. */
export function SiteHeader() {
	return (
		<header className="border-palace-300 border-b bg-palace-200">
			<Frame width="page">
				<nav className="flex items-center gap-x-5 gap-y-1 py-2">
					<Link
						href="/now"
						className="flex shrink-0 items-center gap-1.5 font-semibold font-serif text-lg text-palace-700"
					>
						figgy
					</Link>
					<div className="hidden items-center gap-x-5 sm:flex">
						{ROUTES.map((route) => (
							<NavLink key={route.href} href={route.href}>
								{route.short}
							</NavLink>
						))}
					</div>
					{/*
					 * A cog rather than the word: it is the one thing in the header
					 * that is not a place in the garden, and at 36px it is a thumb
					 * target without making the cover any taller.
					 */}
					<Link
						href="/settings"
						title="Settings"
						aria-label="Settings"
						className="-mr-1.5 ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-palace-700 hover:bg-palace-300"
					>
						<Icon name="settings" className="h-5 w-5" />
					</Link>
				</nav>
			</Frame>
		</header>
	);
}

/**
 * Four destinations within thumb reach.
 *
 * figgy is a standalone PWA that starts at /now, and it is used standing in a
 * garden holding a phone. A row of tabs at the bottom beats a hamburger, and
 * beats the seven links that used to wrap onto two rows and eat the top of
 * every screen.
 */
export function TabBar() {
	return (
		<nav
			aria-label="Sections"
			className="fixed inset-x-0 bottom-0 z-50 flex border-rule border-t bg-paper pb-[env(safe-area-inset-bottom)] sm:hidden"
		>
			{TABS.map((route) => (
				<TabLink key={route.href} href={route.href}>
					{route.short}
				</TabLink>
			))}
		</nav>
	);
}
