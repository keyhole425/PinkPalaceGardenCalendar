'use client';

import { useState } from 'react';
import { ActionChip } from '@/components/ui/ActionChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthStrip } from '@/components/ui/MonthStrip';
import type { Month } from '@/lib/schedule/months';
import { maskRuns, monthAbbr } from '@/lib/schedule/months';
import { hostOf } from '@/lib/ui/hostOf';
import { type EditableRule, RuleEditor } from './RuleEditor';

export type ListedRule = EditableRule & {
	source: string;
	/** The pages Claude took it from, for a rule that was looked up. */
	sources: string[];
	edited: boolean;
};

function summary(monthMask: number): string {
	const runs = maskRuns(monthMask);
	if (runs.length === 0) return 'no months';
	return runs
		.map((r) =>
			r.start === r.end
				? monthAbbr(r.start)
				: `${monthAbbr(r.start)}–${monthAbbr(r.end)}`,
		)
		.join(', ');
}

export function RuleList({
	plantTypeId,
	rules,
	removedActions,
	currentMonth,
}: {
	plantTypeId: number;
	rules: ListedRule[];
	removedActions: string[];
	currentMonth: Month;
}) {
	const [editing, setEditing] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);

	return (
		<div className="space-y-3">
			{rules.length === 0 && (
				<EmptyState>
					No rules yet. Add one below and figgy will start telling you when it is
					due.
				</EmptyState>
			)}

			{rules.map((rule) => {
				const key = rule.ruleIds.join(',');
				const open = editing === key;
				return (
					<div key={key} className="space-y-2">
						<div className="flex flex-wrap items-center gap-3">
							<span className="w-24 shrink-0">
								<ActionChip action={rule.action} />
							</span>
							<MonthStrip
								action={rule.action}
								monthMask={rule.monthMask}
								currentMonth={currentMonth}
							/>
							<span className="text-ink-soft text-sm">
								{summary(rule.monthMask)}
								{rule.alternatives && ' · one of these'}
								{rule.environmentKind && ` · ${rule.environmentKind} only`}
							</span>
							<span className="ml-auto flex items-center gap-2">
								{/*
								 * Where a rule came from is said only when there is
								 * something to say: yours, or Claude's with its pages
								 * underneath. figgy's own starting rules carry no label.
								 */}
								{rule.source !== 'seed' && (
									<span className="text-ink-soft text-xs">
										{rule.source === 'ai' ? 'looked up' : 'yours'}
									</span>
								)}
								<button
									type="button"
									onClick={() => setEditing(open ? null : key)}
									className="text-ink-soft text-sm underline hover:text-palace-700"
								>
									{open ? 'Close' : 'Edit'}
								</button>
							</span>
						</div>
						{rule.note && !open && (
							<p className="pl-24 text-ink-soft text-xs">{rule.note}</p>
						)}
						{rule.sources.length > 0 && !open && (
							<p className="flex flex-wrap gap-x-3 pl-24 text-xs">
								<span className="text-ink-soft">From</span>
								{rule.sources.map((source) => (
									<a
										key={source}
										href={source}
										target="_blank"
										rel="noreferrer noopener"
										className="text-ink-soft underline hover:text-palace-700"
									>
										{hostOf(source)}
									</a>
								))}
							</p>
						)}
						{open && (
							<RuleEditor
								plantTypeId={plantTypeId}
								rule={rule}
								onDone={() => setEditing(null)}
							/>
						)}
					</div>
				);
			})}

			{removedActions.length > 0 && (
				<p className="text-ink-soft text-xs">
					Removed by hand: {removedActions.join(', ')}. Re-seeding leaves these
					alone.
				</p>
			)}

			{adding ? (
				<RuleEditor plantTypeId={plantTypeId} onDone={() => setAdding(false)} />
			) : (
				<button
					type="button"
					onClick={() => setAdding(true)}
					className="min-h-tap rounded-md border border-palace-300 border-dashed px-4 text-palace-700 text-sm hover:bg-palace-50"
				>
					Add a rule
				</button>
			)}
		</div>
	);
}
