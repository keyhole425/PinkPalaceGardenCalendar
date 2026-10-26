import { AskGarden } from '@/components/ai/AskGarden';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { aiAvailable } from '@/lib/ai/client';
import { requireHousehold } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

/** An answer can take several tool calls; give it room. */
export const maxDuration = 120;

export default async function AskPage() {
	const { householdId, role } = await requireHousehold();
	const ai = await aiAvailable(householdId);
	return (
		<Frame width="measure">
			<PageHeader
				title="Ask your garden"
				description="Questions about your own records &mdash; what you grew, what you
					did, and what is due. Claude can read the garden but not change it."
			/>
			<AskGarden available={ai} canAddKey={role === 'admin'} />
		</Frame>
	);
}
