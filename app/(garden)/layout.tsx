import { SiteHeader, TabBar } from '@/components/shell/SiteHeader';
import { SkipLink } from '@/components/shell/SkipLink';
import { Tour } from '@/components/tour/Tour';
import { requireHousehold } from '@/lib/auth/context';
import { activeTour } from '@/lib/tour/state';

/** Every page inside a garden: the cover, the page, the tabs. */
export default async function GardenLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// Cached per request, so the page below asking again costs nothing.
	const tour = await activeTour(await requireHousehold());
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
				{tour && <Tour {...tour} />}
				{children}
			</main>
			<TabBar />
		</>
	);
}
