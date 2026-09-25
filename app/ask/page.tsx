import { AskGarden } from '@/components/ai/AskGarden';
import { aiAvailable } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

export default async function AskPage() {
	return (
		<div className="max-w-2xl space-y-4">
			<div>
				<h1 className="font-semibold text-2xl">Ask your garden</h1>
				<p className="text-ink-soft text-sm">
					Questions about your own records &mdash; what you grew, what you did, and
					what is due. Claude can read the garden but not change it.
				</p>
			</div>
			<AskGarden available={aiAvailable()} />
		</div>
	);
}
