import { CoverHeader } from '@/components/shell/SiteHeader';
import { SkipLink } from '@/components/shell/SkipLink';

/**
 * Outside a garden: signing in, accepting an invite. The same cover, with
 * nothing on it to tap - every link there would only lead back here.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<SkipLink />
			<CoverHeader />
			<main id="main" className="pt-6 pb-10">
				{children}
			</main>
		</>
	);
}
