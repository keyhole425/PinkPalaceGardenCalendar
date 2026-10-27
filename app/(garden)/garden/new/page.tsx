import { PlaceForm } from '@/components/beds/PlaceForm';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { requireHousehold } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';

export default async function NewPlacePage() {
	await requireHousehold();
	return (
		<Frame width="measure">
			<PageHeader
				back={{ href: '/garden', label: '← The garden' }}
				title="Add a place"
				description="A bed, the hothouse, a pot or the orchard. Say how many spots it has and figgy draws it as a plan you can sow into."
			/>
			<PlaceForm />
		</Frame>
	);
}
