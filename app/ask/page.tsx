import { AskGarden } from '@/components/ai/AskGarden';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { aiAvailable } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

export default async function AskPage() {
	return (
		<Frame width="measure">
			<PageHeader
				title="Ask your garden"
				description="Questions about your own records &mdash; what you grew, what you
					did, and what is due. Claude can read the garden but not change it."
			/>
			<AskGarden available={aiAvailable()} />
		</Frame>
	);
}
