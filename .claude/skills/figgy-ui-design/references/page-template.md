# A new screen, from the skeleton

The shape most figgy pages take. Copy, then delete what the page doesn't need.
The nearest real examples: `app/plants/page.tsx` (a list page),
`app/garden/[slug]/page.tsx` (a detail page), `app/now/page.tsx` (a board with
a rail), `app/ask/page.tsx` (a single-purpose `measure` page).

## A list or detail page

```tsx
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataList, DataRow } from '@/components/ui/DataList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Frame } from '@/components/ui/Frame';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatLong } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function WateringPage() {
	const rows = getSomething();

	return (
		<Frame width="list">
			<PageHeader
				back={{ href: '/garden', label: '← The garden' }}
				title="Watering"
				description="Every time something was watered, newest first. What is due is on what’s on."
				actions={<ButtonLink href="/watering/new">Record a watering</ButtonLink>}
			/>

			<div className="space-y-rhythm">
				<Card title="This month" count={rows.length}>
					{rows.length === 0 ? (
						<EmptyState>Nothing watered this month.</EmptyState>
					) : (
						<DataList>
							{rows.map((row) => (
								<DataRow
									key={row.id}
									action={<Link href={`/…/${row.id}`} className="text-ink-soft text-xs underline hover:text-palace-700">Edit</Link>}
								>
									<span className="font-medium">{row.label}</span>
									<span className="text-ink-soft text-xs">{formatLong(row.on)}</span>
								</DataRow>
							))}
						</DataList>
					)}
				</Card>
			</div>
		</Frame>
	);
}
```

## A board with a rail

```tsx
<Frame width="page">
	<PageHeader eyebrow="…" title="…" />
	<div className="grid items-start gap-x-10 gap-y-rhythm lg:grid-cols-[minmax(0,1fr)_20rem]">
		<div className="space-y-rhythm">{/* what you have to do */}</div>
		<aside className="space-y-rhythm">{/* what is worth knowing while you do it */}</aside>
	</div>
</Frame>
```

## A form card

```tsx
<Card as="form" title="Sow something" action={formAction} className="space-y-3">
	<Field label="What">
		<select name="plantTypeId" required className={selectClass}>…</select>
	</Field>
	<Field label="Note" hint="How it went, if it is worth remembering.">
		<textarea name="note" rows={2} placeholder="Took about an hour. Two branches still to do." className={textareaClass} />
	</Field>
	<div className="flex flex-wrap items-center gap-3">
		<Button type="submit" pending={pending} pendingLabel="Saving">Sow it</Button>
		{state && !state.ok && <span className="text-prune-deep text-sm">{state.error}</span>}
	</div>
</Card>
```

## Then

- If it's a destination, add it to `ROUTES` in `lib/nav.ts` (it probably
  doesn't earn one of the four phone tabs).
- Add a row to `docs/design/screens.md`.
- Check it at 375px.
