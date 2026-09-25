import { db } from '@/lib/db/client';
import { meta } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/** Enough to prove the process is up and the database answers. */
export function GET() {
	try {
		db.select().from(meta).limit(1).all();
		return Response.json({ ok: true });
	} catch (error) {
		return Response.json(
			{ ok: false, error: error instanceof Error ? error.message : 'unknown' },
			{ status: 503 },
		);
	}
}
