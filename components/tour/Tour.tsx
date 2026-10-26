'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { dismissTours, finishTour, tourAt } from '@/actions/tour';
import { Button } from '@/components/ui/Button';
import { Frame } from '@/components/ui/Frame';
import type { TourId } from '@/lib/db/schema';
import type { TourStep } from '@/lib/tour/steps';
import { cx } from '@/lib/ui/cx';

/**
 * The first-run tour.
 *
 * It starts as an offer at the top of the page - a note, not a dialog - so
 * nobody is interrupted before they have looked at anything, and nothing
 * takes focus that was not asked for. Saying yes walks a card from place to
 * place, pointing at each thing with the marker ring. On a phone the card is
 * a sheet above the tab bar, so it never covers what it is pointing at.
 *
 * "Not now" is for this visit only; "No thanks" is for good, and Settings can
 * bring it back. Esc puts it away for the visit and keeps the place.
 */

const SNOOZE = 'figgy.tour.snoozed';
const WAIT_FOR_TARGET_MS = 2500;

function snoozed(): boolean {
	try {
		return sessionStorage.getItem(SNOOZE) === '1';
	} catch {
		return false;
	}
}

function snooze() {
	try {
		sessionStorage.setItem(SNOOZE, '1');
	} catch {
		// A private window may refuse; the tour just hides for this page.
	}
}

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The first element with this tour name that is actually on screen. */
function findTarget(name: string): HTMLElement | null {
	for (const el of document.querySelectorAll<HTMLElement>(
		`[data-tour="${name}"]`,
	)) {
		if (
			el.getClientRects().length > 0 &&
			getComputedStyle(el).visibility !== 'hidden'
		) {
			return el;
		}
	}
	return null;
}

type Placement = { top: number; left: number; width: number } | null;

const GUTTER = 12;
const CARD_WIDTH = 352;

/** Below the target if it fits, above if not, the middle of the screen otherwise. */
function place(target: HTMLElement | null, cardHeight: number): Placement {
	if (!target) return null;
	const rect = target.getBoundingClientRect();
	const width = Math.min(CARD_WIDTH, window.innerWidth - GUTTER * 2);
	const left = Math.min(
		Math.max(GUTTER, rect.left),
		window.innerWidth - width - GUTTER,
	);
	if (rect.bottom + GUTTER + cardHeight < window.innerHeight) {
		return { top: rect.bottom + GUTTER, left, width };
	}
	if (rect.top - GUTTER - cardHeight > 0) {
		return { top: rect.top - GUTTER - cardHeight, left, width };
	}
	return null;
}

export function Tour({
	tourId,
	status,
	steps,
	startAt,
	householdName,
	thenBasics,
}: {
	tourId: TourId;
	status: 'pending' | 'in_progress';
	steps: TourStep[];
	startAt: number;
	householdName: string;
	thenBasics: boolean;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const [mode, setMode] = useState<'offer' | 'touring' | 'hidden'>(
		status === 'in_progress' ? 'touring' : 'offer',
	);
	const [index, setIndex] = useState(startAt);
	const [target, setTarget] = useState<HTMLElement | null>(null);
	const [placement, setPlacement] = useState<Placement>(null);
	const [phone, setPhone] = useState(false);
	const card = useRef<HTMLDivElement>(null);
	const returnFocus = useRef<HTMLElement | null>(null);
	const titleId = useId();

	const step = steps[Math.min(index, steps.length - 1)];
	const last = index >= steps.length - 1;

	// A new tour from the server (setup finished, basics begins) starts over.
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new tourId is the signal to start over
	useEffect(() => {
		setMode(status === 'in_progress' ? 'touring' : 'offer');
		setIndex(startAt);
	}, [tourId, status, startAt]);

	// Sessions where the person said "not now".
	useEffect(() => {
		if (snoozed()) setMode('hidden');
	}, []);

	useEffect(() => {
		const query = window.matchMedia('(max-width: 639px)');
		const update = () => setPhone(query.matches);
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	}, []);

	// Go to the step's page, then wait for its element to turn up.
	useEffect(() => {
		if (mode !== 'touring' || !step) return;
		if (pathname !== step.route) {
			router.push(step.route);
			return;
		}
		if (!step.target) {
			setTarget(null);
			return;
		}
		const name = step.target;
		let found = findTarget(name);
		if (found) {
			setTarget(found);
			return;
		}
		const observer = new MutationObserver(() => {
			found = findTarget(name);
			if (found) {
				observer.disconnect();
				setTarget(found);
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		const giveUp = setTimeout(() => {
			observer.disconnect();
			setTarget(null);
		}, WAIT_FOR_TARGET_MS);
		return () => {
			observer.disconnect();
			clearTimeout(giveUp);
		};
	}, [mode, step, pathname, router]);

	// On a phone the card is a sheet over the bottom of the screen. Give the
	// page that much more room at the end, or a target near the bottom - Add a
	// place, say - could never scroll out from under it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the card's height changes with each step's text
	useLayoutEffect(() => {
		if (mode !== 'touring' || !phone) return;
		const main = document.getElementById('main');
		if (!main) return;
		const before = main.style.paddingBottom;
		main.style.paddingBottom = `${(card.current?.offsetHeight ?? 240) + 96}px`;
		return () => {
			main.style.paddingBottom = before;
		};
	}, [mode, phone, index]);

	// Mark the target and bring it into view.
	useEffect(() => {
		if (mode !== 'touring' || !target) return;
		target.setAttribute('data-tour-active', '');
		target.scrollIntoView({
			block: phone ? 'start' : 'center',
			behavior: prefersReducedMotion() ? 'auto' : 'smooth',
		});
		return () => target.removeAttribute('data-tour-active');
	}, [mode, target, phone]);

	// Keep the card beside its target as the page scrolls and resizes.
	useLayoutEffect(() => {
		if (mode !== 'touring' || phone) return;
		let frame = 0;
		const update = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() =>
				setPlacement(place(target, card.current?.offsetHeight ?? 220)),
			);
		};
		update();
		window.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('scroll', update);
			window.removeEventListener('resize', update);
		};
	}, [mode, target, phone]);

	// The card takes focus on each step, because each step was asked for.
	// biome-ignore lint/correctness/useExhaustiveDependencies: each new step index is the signal to refocus
	useEffect(() => {
		if (mode === 'touring') card.current?.focus({ preventScroll: true });
	}, [mode, index]);

	const putAway = useCallback(() => {
		snooze();
		setMode('hidden');
		returnFocus.current?.focus();
	}, []);

	function start() {
		returnFocus.current = document.activeElement as HTMLElement | null;
		setIndex(0);
		setMode('touring');
		void tourAt(tourId, steps[0]?.id ?? '');
	}

	function go(to: number) {
		const next = steps[to];
		if (!next) return;
		setIndex(to);
		void tourAt(tourId, next.id);
	}

	async function done() {
		setMode('hidden');
		returnFocus.current?.focus();
		await finishTour(tourId);
		router.refresh();
	}

	async function noThanks() {
		setMode('hidden');
		await dismissTours();
		router.refresh();
	}

	function onKeyDown(event: React.KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			putAway();
		} else if (event.key === 'ArrowRight' && !last) {
			go(index + 1);
		} else if (event.key === 'ArrowLeft' && index > 0) {
			go(index - 1);
		}
	}

	if (mode === 'hidden' || !step) return null;

	if (mode === 'offer') {
		return (
			<Frame width="page" className="mb-rhythm">
				<aside
					aria-label="Getting started"
					data-tour-offer=""
					className="max-w-measure space-y-3 rounded-md border border-palace-300 bg-palace-50 p-3 text-sm"
				>
					<p className="font-semibold font-serif text-lg">
						Welcome to {householdName}
					</p>
					<p>
						{tourId === 'setup'
							? 'A few things to set up, then a look round the garden. A couple of minutes, and you can stop whenever you like.'
							: 'A quick look round, so you know where everything is. A minute or two.'}
					</p>
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
						<Button onClick={start}>Show me around</Button>
						<Button
							variant="quiet"
							onClick={() => {
								snooze();
								setMode('hidden');
							}}
						>
							Not now
						</Button>
						<Button variant="quiet" onClick={() => void noThanks()}>
							No thanks, I&rsquo;ll explore
						</Button>
					</div>
				</aside>
			</Frame>
		);
	}

	const anchored = !phone && placement;
	return (
		<div
			ref={card}
			role="dialog"
			aria-modal="false"
			aria-labelledby={titleId}
			tabIndex={-1}
			onKeyDown={onKeyDown}
			style={
				anchored
					? { top: placement.top, left: placement.left, width: placement.width }
					: undefined
			}
			className={cx(
				'fixed z-60 space-y-2 rounded-md border border-palace-300 bg-palace-50 p-3 text-sm outline-none',
				anchored
					? ''
					: phone
						? 'inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))]'
						: 'top-1/2 left-1/2 w-[22rem] max-w-[calc(100vw-2.5rem)] -translate-x-1/2 -translate-y-1/2',
			)}
		>
			<p className="text-ink-soft text-xs tabular-nums">
				{tourId === 'setup' ? 'Setting up' : 'Looking round'} · {index + 1} of{' '}
				{steps.length}
			</p>
			<h2 id={titleId} className="font-semibold font-serif text-lg">
				{step.title}
			</h2>
			<p>{step.body}</p>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
				{last ? (
					<Button onClick={() => void done()}>
						{thenBasics ? 'Now a look round' : 'Done'}
					</Button>
				) : (
					<Button onClick={() => go(index + 1)}>Next</Button>
				)}
				{index > 0 && (
					<Button variant="quiet" onClick={() => go(index - 1)}>
						Back
					</Button>
				)}
				<Button variant="quiet" className="ml-auto" onClick={() => void noThanks()}>
					Skip the tour
				</Button>
			</div>
		</div>
	);
}
