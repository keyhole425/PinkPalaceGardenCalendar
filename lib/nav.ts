/**
 * Where figgy's pages are, in the order they appear.
 *
 * One record per destination, carrying both names: `label` is what the page
 * calls itself, `short` is what fits in a nav. They live together so the nav
 * and the page title cannot drift apart, which is how we ended up with a tab
 * saying "Beds" above a heading saying "Beds and the hothouse".
 */
export type Route = {
	href: string;
	label: string;
	short: string;
};

export const ROUTES: readonly Route[] = [
	{ href: '/now', label: 'What’s on', short: 'Now' },
	{ href: '/grid', label: 'The year', short: 'Year' },
	{ href: '/garden', label: 'The garden', short: 'Garden' },
	{ href: '/plants', label: 'Plants', short: 'Plants' },
	{ href: '/ask', label: 'Ask your garden', short: 'Ask' },
] as const;

/** The four that earn a thumb-sized tab on a phone. Ask stays in the header. */
export const TABS: readonly Route[] = ROUTES.slice(0, 4);
