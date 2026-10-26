/** A source's site, which is what a gardener recognises, not its full URL. */
export function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}
