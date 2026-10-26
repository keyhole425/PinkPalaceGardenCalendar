import { db } from '@/lib/db/client';
import { meta } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/** Enough to prove the process is up and the database answers. */
export async function GET() {
	try {
		await db.select().from(meta).limit(1).all();
		return Response.json({ ok: true });
	} catch (error) {
		// The reason goes to the log, not the response: this route is public,
		// and a driver error can name the database host.
		console.error('figgy: health check failed:', error);
		return Response.json({ ok: false }, { status: 503 });
	}
}
