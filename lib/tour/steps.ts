/**
 * The first-run tours, as data.
 *
 * Two of them. `setup` is for whoever runs a household: name it, lay out the
 * places, decide about Claude, bring people in. `basics` is for everyone: where
 * things are and what to tap. Each step names the page it is on and the
 * `data-tour` element it points at; a step whose element is not on the page
 * shows in the middle of the screen instead, so a missing target is never a
 * broken tour.
 *
 * Steps are chosen on the server, from who is asking. A member is never sent
 * the setup tour, and nobody is shown how to ask Claude in a household that
 * has not switched Claude on.
 */
import type { Role, TourId } from '@/lib/db/schema';

export type TourContext = {
	role: Role;
	siteAdmin: boolean;
	aiAvailable: boolean;
	householdName: string;
};

export type TourStep = {
	id: string;
	route: string;
	/** The `data-tour` value to point at. None means the middle of the screen. */
	target?: string;
	title: string;
	body: string;
};

type StepDefinition = Omit<TourStep, 'title' | 'body'> & {
	title: string | ((ctx: TourContext) => string);
	body: string | ((ctx: TourContext) => string);
	when?: (ctx: TourContext) => boolean;
};

const SETUP: StepDefinition[] = [
	{
		id: 'name',
		route: '/settings',
		target: 'household',
		title: 'Name your garden',
		body: 'Everyone in the household sees this name. Change it here whenever you like.',
	},
	{
		id: 'places',
		route: '/garden',
		target: 'add-place',
		title: 'Lay out your places',
		body: 'Every garden starts with one bed. Add the rest here: more beds, a hothouse, the orchard, pots. A hothouse can run a month ahead, and figgy moves its sowing to match.',
	},
	{
		id: 'claude',
		route: '/settings',
		target: 'ai-key',
		title: 'Decide about Claude',
		body: 'figgy can look a plant up, answer questions about the garden and read a sentence like “pruned the fig”, but each of those asks Claude, which needs an Anthropic key. Add one here and the whole household can use it. Without one, everything else works just the same.',
	},
	{
		id: 'invite',
		route: '/settings',
		target: 'invite',
		title: 'Bring your household in',
		body: 'Make a link and send it to them. Each one works once, for a week. Admins can invite and remove people; members garden.',
	},
	{
		id: 'new-gardens',
		route: '/settings',
		target: 'new-gardens',
		title: 'Gardens for friends',
		body: 'As a site admin you can also invite someone to start a garden of their own. They will not see this one, and you will not see theirs.',
		when: (ctx) => ctx.siteAdmin,
	},
];

const BASICS: StepDefinition[] = [
	{
		id: 'board',
		route: '/now',
		target: 'board',
		title: 'What’s on',
		body: 'What needs doing now, what slipped past, and what is coming up. Tap Done when it is done, or Date or note if it was another day.',
	},
	{
		id: 'sentence',
		route: '/now',
		target: 'log-sentence',
		title: 'Say what you did',
		body: 'Write it the way you would say it - “netted the cherries and picked 2 kg of lemons” - and figgy sorts it into records. Nothing is saved until you have looked.',
		when: (ctx) => ctx.aiAvailable,
	},
	{
		id: 'weather',
		route: '/now',
		target: 'weather',
		title: 'The week’s weather',
		body: 'From the Bureau, with the frost, the heat and the rain worth knowing about said out loud.',
	},
	{
		id: 'year',
		route: '/grid',
		target: 'year',
		title: 'The year',
		body: 'Every plant and every month: when to feed, prune and pick, and a tick for what has been done.',
	},
	{
		id: 'garden',
		route: '/garden',
		target: 'places',
		title: 'The garden',
		body: 'Every place things grow. Open one to sow something in it; figgy says so if the same family was there too recently.',
	},
	{
		id: 'plants',
		route: '/plants',
		target: 'plants',
		title: 'Plants',
		body: (ctx) =>
			ctx.aiAvailable
				? 'Everything figgy knows how to grow, and what each one needs. Add a plant from here, or let Claude look one up.'
				: 'Everything figgy knows how to grow, and what each one needs. Add a plant from here.',
	},
	{
		id: 'ask',
		route: '/ask',
		target: 'ask',
		title: 'Ask your garden',
		body: 'Questions about your own records: when the lemon was last fed, what is nearly ready. Claude can read the garden but not change it.',
		when: (ctx) => ctx.aiAvailable,
	},
	{
		id: 'settings',
		route: '/now',
		target: 'settings',
		title: 'Settings',
		body: 'Your household, the Anthropic key and signing out are under the cog. This tour is there too, if you want it again.',
	},
];

const TOURS: Record<TourId, StepDefinition[]> = { setup: SETUP, basics: BASICS };

/** Which tours this person gets, in the order they come. */
export function toursFor(ctx: TourContext): TourId[] {
	return ctx.role === 'admin' ? ['setup', 'basics'] : ['basics'];
}

export function stepsFor(tourId: TourId, ctx: TourContext): TourStep[] {
	return TOURS[tourId]
		.filter((step) => step.when?.(ctx) ?? true)
		.map(({ when: _when, title, body, ...step }) => ({
			...step,
			title: typeof title === 'function' ? title(ctx) : title,
			body: typeof body === 'function' ? body(ctx) : body,
		}));
}
