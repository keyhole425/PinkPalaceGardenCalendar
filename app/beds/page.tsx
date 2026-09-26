import { redirect } from 'next/navigation';

/**
 * Beds moved into The garden.
 *
 * A bed and the orchard were always the same row in the same `environment`
 * table; showing them on two pages was what made Places and Beds feel like
 * unrelated ideas. Kept as a redirect so old links and any installed PWA
 * shortcut still land somewhere sensible.
 */
export default function BedsPage() {
	redirect('/garden');
}
