import { EmptyState } from '@/components/ui/EmptyState';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';

/**
 * Where requireHousehold() sends a request it cannot place in a garden. It
 * reads nothing from the database, so it cannot loop back on itself.
 */
export default function NoGardenPage() {
	return (
		<Frame width="measure">
			<PageHeader
				title="No garden here yet"
				description="figgy keeps one notebook per garden, and there is not one to open."
			/>
			<EmptyState>
				Nothing has been planted in this copy of figgy. Run{' '}
				<code className="font-mono">npm run db:seed</code> to start the Pink Palace,
				or ask whoever runs it to invite you in.
			</EmptyState>
		</Frame>
	);
}
