'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Looks again every few seconds while Claude is still researching, so the
 * proposal appears without anyone having to know to reload. Stops as soon
 * as the page it is on stops rendering it.
 */
export function RefreshWhileRunning({ everyMs = 4000 }: { everyMs?: number }) {
	const router = useRouter();
	useEffect(() => {
		const timer = setInterval(() => router.refresh(), everyMs);
		return () => clearInterval(timer);
	}, [router, everyMs]);
	return null;
}
