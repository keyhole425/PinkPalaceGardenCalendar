import { cx } from '@/lib/ui/cx';

/**
 * figgy's only pictures.
 *
 * Drawn rather than installed: an icon font or a package would be the first
 * runtime UI dependency in the app, and these are nine shapes. They are all
 * one weight, one grid and currentColor, so an icon is the same ink as the
 * text beside it and inherits its size with h-4 w-4 rather than a prop.
 *
 * Rule: an icon is either decoration beside a word - and then it is
 * aria-hidden, which is the default - or it IS the control, and then it takes
 * a `title` and becomes an image with a name. There is no third case.
 */
export type IconName =
	| 'sun'
	| 'cloud'
	| 'showers'
	| 'rain'
	| 'storm'
	| 'frost'
	| 'thermometer'
	| 'wind'
	| 'droplet'
	| 'pencil'
	| 'settings'
	| 'calendar'
	| 'close'
	| 'check';

const PATHS: Record<IconName, React.ReactNode> = {
	sun: (
		<>
			<circle cx="12" cy="12" r="4.5" />
			<path d="M12 1.8v2.4M12 19.8v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" />
		</>
	),
	cloud: <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />,
	// One cloud arc, three ways of raining under it.
	showers: (
		<>
			<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
			<path d="M8 18.5v1.6M12 19.5v1.6M16 18.5v1.6" />
		</>
	),
	rain: (
		<>
			<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
			<path d="M8.8 18.2 7.6 22M13 18.2 11.8 22M17.2 18.2 16 22" />
		</>
	),
	storm: (
		<>
			<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
			<path d="M13.4 16 10.2 20.2h3.2L11 23.4" />
		</>
	),
	frost: (
		<>
			<path d="M12 2.4v19.2M4.1 7.2l15.8 9.6M19.9 7.2 4.1 16.8" />
			<path d="m9.5 4.9 2.5 2.5 2.5-2.5M9.5 19.1l2.5-2.5 2.5 2.5" />
		</>
	),
	thermometer: <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4 4 0 1 0 5 0z" />,
	wind: (
		<path d="M9.6 4.6A2 2 0 1 1 11 8H2m10.6 11.4A2 2 0 1 0 14 16H2m15.7-8.3A2.5 2.5 0 1 1 19.5 12H2" />
	),
	droplet: <path d="M12 2.7 17.7 8.4a8 8 0 1 1-11.4 0z" />,
	pencil: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />,
	settings: (
		<>
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
		</>
	),
	calendar: (
		<>
			<rect x="3" y="4.5" width="18" height="17" rx="2" />
			<path d="M16 2.5v4M8 2.5v4M3 10h18" />
		</>
	),
	close: <path d="M18 6 6 18M6 6l12 12" />,
	check: <path d="M20 6 9 17l-5-5" />,
};

export function Icon({
	name,
	className,
	title,
}: {
	name: IconName;
	/** Size and colour, like any other text: h-4 w-4 text-ink-soft. */
	className?: string;
	/** Only when the icon carries meaning no nearby word already carries. */
	title?: string;
}) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.75}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={cx('inline-block h-4 w-4 shrink-0', className)}
			role={title ? 'img' : undefined}
			aria-hidden={title ? undefined : true}
			aria-label={title}
		>
			{title && <title>{title}</title>}
			{PATHS[name]}
		</svg>
	);
}
