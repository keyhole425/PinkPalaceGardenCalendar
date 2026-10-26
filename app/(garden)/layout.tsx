import { SiteHeader, TabBar } from '@/components/shell/SiteHeader';
import { SkipLink } from '@/components/shell/SkipLink';

/** Every page inside a garden: the cover, the page, the tabs. */
export default function GardenLayout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<SkipLink />
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
		</>
	);
}
