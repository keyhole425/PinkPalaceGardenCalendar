import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { getSession } from '@/lib/auth/context';

export const metadata: Metadata = { title: 'Sign in · figgy' };

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ next?: string }>;
}) {
	if (await getSession()) redirect('/now');
	const { next } = await searchParams;

	return (
		<Frame width="measure">
			<PageHeader
				title="Sign in"
				description="figgy is invite-only. If someone sent you a link, open it to make your account; this is for coming back."
			/>
			<LoginForm next={next} />
		</Frame>
	);
}
