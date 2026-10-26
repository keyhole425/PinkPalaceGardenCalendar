import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { JoinForm, ResetForm } from '@/components/auth/JoinForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { db } from '@/lib/db/client';
import { household, user } from '@/lib/db/schema';
import { findOpenInvite } from '@/lib/invites';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
	title: 'Your invite · figgy',
	// The token is in this page's address. Nothing here links out, and the
	// browser is told not to pass the address on if anything ever does.
	referrer: 'no-referrer',
	robots: { index: false, follow: false },
};

export default async function JoinPage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;
	const open = await findOpenInvite(token);

	if (!open) {
		return (
			<Frame width="measure">
				<PageHeader title="That link has run out" />
				<EmptyState>
					Invites work once, for a week. Ask whoever sent it for a new one. If you
					already made your account,{' '}
					<Link href="/login" className="underline">
						sign in
					</Link>
					.
				</EmptyState>
			</Frame>
		);
	}

	if (open.kind === 'reset_password' && open.userId) {
		const person = await db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, open.userId))
			.get();
		return (
			<Frame width="measure">
				<PageHeader
					title="Choose a new password"
					description={`For ${person?.email ?? 'your account'}. You will be signed out everywhere else.`}
				/>
				<ResetForm token={token} />
			</Frame>
		);
	}

	if (open.kind === 'new_household') {
		return (
			<Frame width="measure">
				<PageHeader
					title="Start your garden"
					description="Someone has kept you a place in figgy. Your garden starts with a catalogue of vegetables and one bed, and everything in it is yours to change."
				/>
				<JoinForm token={token} startsGarden email={open.email} />
			</Frame>
		);
	}

	const home = open.householdId
		? await db
				.select({ name: household.name })
				.from(household)
				.where(eq(household.id, open.householdId))
				.get()
		: undefined;
	return (
		<Frame width="measure">
			<PageHeader
				title={`Join ${home?.name ?? 'the garden'}`}
				description={`${home?.name ?? 'This household'} keeps its garden in figgy. Make an account to look after it with them.`}
			/>
			<JoinForm token={token} startsGarden={false} email={open.email} />
		</Frame>
	);
}
