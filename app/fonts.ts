/**
 * figgy's two typefaces.
 *
 * Fraunces is an old-style serif with a soft, seed-packet warmth - the
 * notebook's handwriting, kept restrained. IBM Plex Sans carries everything
 * that has to line up: dates, temperatures, the tick counts in the year grid.
 * Its figures are properly tabular, which Inter's are not.
 *
 * next/font downloads these at build time and serves them from our own origin,
 * so there is no runtime request to Google and no flash of unstyled text.
 */
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';

export const sans = IBM_Plex_Sans({
	subsets: ['latin'],
	weight: ['400', '500', '600'],
	display: 'swap',
	variable: '--font-figgy-sans',
});

export const serif = Fraunces({
	subsets: ['latin'],
	// A variable font: the weight range comes for free, but the optical axes
	// have to be asked for by name.
	axes: ['SOFT', 'WONK'],
	display: 'swap',
	variable: '--font-figgy-serif',
});

/** Only for the handful of <code> spans in settings and ask. */
export const mono = IBM_Plex_Mono({
	subsets: ['latin'],
	weight: ['400'],
	display: 'swap',
	preload: false,
	variable: '--font-figgy-mono',
});
