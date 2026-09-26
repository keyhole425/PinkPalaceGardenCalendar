import { redirect } from 'next/navigation';

/** See app/beds/page.tsx: this bed now lives under /garden. */
export default async function BedRedirect({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	redirect(`/garden/${slug}`);
}
