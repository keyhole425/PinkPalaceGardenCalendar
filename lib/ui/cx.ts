/**
 * Join class names, dropping anything falsy.
 *
 * Deliberately not clsx. figgy has no UI dependencies, and the variant maps in
 * this codebase are all single-axis lookups of complete literal strings -
 * Tailwind scans source text, so a class name can never be assembled at
 * runtime anyway. Six lines buys the same thing.
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
	return parts.filter(Boolean).join(' ');
}
