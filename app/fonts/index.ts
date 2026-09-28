/**
 * figgy's two typefaces, served from this directory.
 *
 * Fraunces is an old-style serif with a soft, seed-packet warmth - the
 * notebook's handwriting, kept restrained. IBM Plex Sans carries everything
 * that has to line up: dates, temperatures, the tick counts in the year grid.
 * Its figures are properly tabular, which Inter's are not.
 *
 * The .woff2 files are committed rather than fetched. next/font/google
 * downloads at *build* time, which quietly made `npm run build` - and so both
 * the Docker image and the e2e suite, which builds before it runs - depend on
 * reaching fonts.gstatic.com. Vendoring them also pins the exact bytes, so a
 * font revision upstream cannot change how figgy looks between builds.
 *
 * These are the Google Fonts `latin` subsets, which cover U+0000-00FF plus the
 * punctuation used here. Nothing in figgy is written outside that range, and
 * the saving over shipping Cyrillic, Greek and Vietnamese as well is most of
 * the payload.
 *
 * The exports are named figgySans and figgySerif rather than sans and serif
 * because next/font/local takes the font-family name from the export: a const
 * called `serif` produces font-family: "serif", one quoting away from the CSS
 * generic that would silently drop every heading back to Times.
 */
import localFont from 'next/font/local';

export const figgySans = localFont({
	src: [
		{ path: './ibm-plex-sans-400.woff2', weight: '400', style: 'normal' },
		{ path: './ibm-plex-sans-500.woff2', weight: '500', style: 'normal' },
		{ path: './ibm-plex-sans-600.woff2', weight: '600', style: 'normal' },
		/*
		 * A real italic, because figgy sets a lot of scientific names: every
		 * row of /plants is a binomial in <em>. Without this the browser
		 * slants the upright face, and a sloped humanist sans is not what its
		 * italic looks like - Plex draws a true single-storey a.
		 *
		 * 400 only. Every <em> here sits in normal-weight body text, and
		 * carrying weights nothing asks for is what made Fraunces 120KB.
		 */
		{
			path: './ibm-plex-sans-400-italic.woff2',
			weight: '400',
			style: 'italic',
		},
	],
	display: 'swap',
	variable: '--font-figgy-sans',
	// What the browser draws with while the face loads. Measured from the
	// system stack so the swap does not shift the page around.
	fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
});

/**
 * One variable file covering the whole weight range.
 *
 * Fraunces also has optical-size, SOFT and WONK axes. figgy sets none of them,
 * and carrying them cost 120KB against 36KB for the weight axis alone - so the
 * file here is the wght-only cut.
 */
export const figgySerif = localFont({
	src: [
		{ path: './fraunces-variable.woff2', weight: '100 900', style: 'normal' },
		/*
		 * Nothing sets serif italic today - every <em> in figgy sits in body
		 * text. It is here so the family is whole: a heading or a pull quote
		 * can be italicised without another trip to Google.
		 *
		 * It costs nothing to carry. Next emits no <link rel="preload"> for
		 * fonts, and the face stays unactivated on a page that never renders
		 * serif italic - both checked rather than assumed.
		 */
		{
			path: './fraunces-italic-variable.woff2',
			weight: '100 900',
			style: 'italic',
		},
	],
	display: 'swap',
	variable: '--font-figgy-serif',
	fallback: ['ui-serif', 'Georgia', 'serif'],
});

/** Only for the handful of <code> spans in settings and ask. */
export const figgyMono = localFont({
	src: './ibm-plex-mono-400.woff2',
	weight: '400',
	style: 'normal',
	display: 'swap',
	preload: false,
	variable: '--font-figgy-mono',
	fallback: ['ui-monospace', 'monospace'],
});
