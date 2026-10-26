/** The first thing a keyboard reaches: past the cover to the page. */
export function SkipLink() {
	return (
		<a
			href="#main"
			className="sr-only rounded-md bg-paper px-4 py-2 text-palace-700 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
		>
			Skip to content
		</a>
	);
}
