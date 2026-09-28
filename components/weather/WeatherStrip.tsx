import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { GARDEN_LOCALE } from '@/lib/ai/locale';
import { formatShort } from '@/lib/dates';
import { cx } from '@/lib/ui/cx';
import {
	type Condition,
	conditionOf,
	type Forecast,
	type ForecastSource,
	type Signal,
	type SignalKind,
} from '@/lib/weather';

/** Every condition gets a picture and a word; the word is for screen readers. */
const SKY: Record<Condition, { icon: IconName; label: string }> = {
	clear: { icon: 'sun', label: 'Clear' },
	cloud: { icon: 'cloud', label: 'Cloudy' },
	showers: { icon: 'showers', label: 'Showers' },
	rain: { icon: 'rain', label: 'Rain' },
	storm: { icon: 'storm', label: 'Storms' },
	frost: { icon: 'frost', label: 'Frost possible' },
	hot: { icon: 'thermometer', label: 'Hot' },
	windy: { icon: 'wind', label: 'Windy' },
};

/**
 * The two conditions worth colouring. Everything else is ink: a week of
 * five coloured icons is a week with nothing to notice in it.
 */
const SKY_TONE: Partial<Record<Condition, string>> = {
	frost: 'text-palace-700',
	hot: 'text-prune-deep',
	storm: 'text-prune-deep',
};

const SIGNAL: Record<SignalKind, { icon: IconName; tone: string; ink: string }> = {
	frost: {
		icon: 'frost',
		tone: 'border-palace-500/50 bg-palace-100',
		ink: 'text-palace-700',
	},
	cold: {
		icon: 'thermometer',
		tone: 'border-rule bg-paper-sunk',
		ink: 'text-ink-soft',
	},
	heat: {
		icon: 'thermometer',
		tone: 'border-prune bg-prune-soft',
		ink: 'text-prune-deep',
	},
	rain: {
		icon: 'rain',
		tone: 'border-rule bg-paper-sunk',
		ink: 'text-ink-soft',
	},
	wind: {
		icon: 'wind',
		tone: 'border-rule bg-paper-sunk',
		ink: 'text-ink-soft',
	},
};

/**
 * Who said so.
 *
 * Named on the card rather than buried, because the two sources do not agree
 * to the degree and because a quiet fall back to Open-Meteo would otherwise
 * look like the Bureau changing its mind. Open-Meteo is credited either way:
 * the wind in any signal below came from it even when the Bureau led.
 */
function credit(source: ForecastSource): string {
	return source === 'bom' ? 'Bureau of Meteorology · Open-Meteo' : 'Open-Meteo';
}

function dayLabel(date: string, today: string): string {
	if (date === today) return 'Today';
	const days = Math.round(
		(Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
			86_400_000,
	);
	if (days === 1) return 'Tmrw';
	return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-AU', {
		weekday: 'short',
		timeZone: 'UTC',
	});
}

export function WeatherStrip({
	forecast,
	signals,
	today,
}: {
	forecast: Forecast;
	signals: Signal[];
	today: string;
}) {
	// Two is enough. A list of every warm afternoon this week is not advice.
	const worthSaying = signals.slice(0, 2);

	return (
		<Card
			title="Weather"
			icon={<Icon name="cloud" className="h-[1.05em] w-[1.05em]" />}
			aside={<span className="text-ink-faint text-xs">{GARDEN_LOCALE.city}</span>}
		>
			<ul className="grid grid-cols-5 gap-1">
				{forecast.days.slice(0, 5).map((day) => {
					const sky = SKY[conditionOf(day)];
					const isToday = day.date === today;
					return (
						<li
							key={day.date}
							className={cx(
								'flex flex-col items-center rounded-md border px-0.5 py-1.5',
								isToday ? 'border-palace-300 bg-palace-50' : 'border-rule bg-paper',
							)}
						>
							<span
								className={cx(
									'block max-w-full truncate text-2xs',
									isToday ? 'font-semibold text-palace-700' : 'font-medium',
								)}
							>
								{dayLabel(day.date, today)}
							</span>
							<Icon
								name={sky.icon}
								title={sky.label}
								className={cx(
									'my-1 h-5 w-5',
									SKY_TONE[conditionOf(day)] ?? 'text-ink-soft',
								)}
							/>
							{/* Max over min, the way every forecast has always read. */}
							<span className="block font-medium text-sm tabular-nums leading-none">
								{day.maxC.toFixed(0)}&deg;
							</span>
							<span className="mt-0.5 block text-ink-soft text-2xs tabular-nums leading-none">
								{day.minC.toFixed(0)}&deg;
							</span>
							{day.rainMm >= 1 && (
								<span className="mt-1 flex items-center gap-0.5 text-ink-faint text-2xs tabular-nums leading-none">
									<Icon name="droplet" className="h-2.5 w-2.5" />
									{day.rainMm.toFixed(0)}
								</span>
							)}
						</li>
					);
				})}
			</ul>

			<p className="text-ink-faint text-2xs">
				Daily high over low in &deg;C, and rain in mm. {credit(forecast.source)}.
			</p>

			{worthSaying.length > 0 && (
				<ul className="space-y-1">
					{worthSaying.map((signal) => (
						<li
							key={`${signal.kind}-${signal.date}`}
							className={`flex gap-2 rounded-md border p-2 text-xs ${SIGNAL[signal.kind].tone}`}
						>
							<Icon
								name={SIGNAL[signal.kind].icon}
								className={`mt-px h-4 w-4 ${SIGNAL[signal.kind].ink}`}
							/>
							<span className="min-w-0">
								<strong>{dayLabel(signal.date, today)}</strong>{' '}
								<span className="text-ink-soft">{formatShort(signal.date)}</span>{' '}
								&mdash; {signal.message}
							</span>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}
