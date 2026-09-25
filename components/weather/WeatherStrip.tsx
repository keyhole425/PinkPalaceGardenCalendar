import { formatShort } from '@/lib/dates';
import type { Forecast, Signal } from '@/lib/weather';

const TONE: Record<string, string> = {
	frost: 'border-palace-500/50 bg-palace-100',
	cold: 'border-rule bg-paper-sunk',
	heat: 'border-prune/40 bg-prune-soft',
	rain: 'border-rule bg-paper-sunk',
	wind: 'border-rule bg-paper-sunk',
};

function dayLabel(date: string, today: string): string {
	if (date === today) return 'Today';
	const days = Math.round(
		(Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
			86_400_000,
	);
	if (days === 1) return 'Tomorrow';
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
		<section className="space-y-2">
			<h2 className="font-semibold text-lg">The week</h2>

			<ul className="flex flex-wrap gap-2">
				{forecast.days.slice(0, 5).map((day) => (
					<li
						key={day.date}
						className="min-w-24 rounded-md border border-rule bg-paper px-3 py-2 text-sm"
					>
						<span className="block font-medium">{dayLabel(day.date, today)}</span>
						<span className="block text-ink-soft">
							{day.minC.toFixed(0)}&ndash;{day.maxC.toFixed(0)}&deg;C
						</span>
						{day.rainMm >= 1 && (
							<span className="block text-ink-soft text-xs">
								{day.rainMm.toFixed(0)} mm
							</span>
						)}
					</li>
				))}
			</ul>

			{worthSaying.length > 0 && (
				<ul className="space-y-1">
					{worthSaying.map((signal) => (
						<li
							key={`${signal.kind}-${signal.date}`}
							className={`rounded-md border p-2 text-sm ${TONE[signal.kind] ?? 'border-rule bg-paper-sunk'}`}
						>
							<strong>{dayLabel(signal.date, today)}</strong>{' '}
							<span className="text-ink-soft text-xs">
								{formatShort(signal.date)}
							</span>{' '}
							&mdash; {signal.message}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
