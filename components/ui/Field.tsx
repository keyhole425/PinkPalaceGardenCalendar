import { cx } from '@/lib/ui/cx';

/**
 * A labelled control.
 *
 * The label wraps its input rather than pointing at one by id. That is the
 * idiom the forms already use, it needs no generated ids in a server
 * component, and getByLabel('What') depends on it.
 *
 * The control classes are exported rather than applied to a wrapped child, so
 * every input keeps its own name, required, max, defaultValue and onChange
 * without this component having to know about them.
 */
export const inputClass =
	'mt-0.5 block min-h-tap w-full rounded-md border border-rule bg-paper px-2 text-ink text-sm';

export const selectClass = inputClass;

export const textareaClass =
	'mt-0.5 block w-full rounded-md border border-rule bg-paper px-2 py-1 text-ink text-sm';

export function Field({
	label,
	hint,
	className,
	children,
}: {
	label: React.ReactNode;
	hint?: React.ReactNode;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: the control is the child, which is the point
		<label className={cx('block text-ink-soft text-sm', className)}>
			{label}
			{children}
			{hint && <span className="mt-0.5 block text-ink-faint text-xs">{hint}</span>}
		</label>
	);
}
