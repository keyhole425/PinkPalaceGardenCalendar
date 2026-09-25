'use client';

import { useState } from 'react';
import { ActionChip } from '@/components/tasks/TaskCard';
import type { Month } from '@/lib/schedule/months';
import { maskRuns, monthAbbr } from '@/lib/schedule/months';
import { type EditableRule, RuleEditor } from './RuleEditor';
import { RuleStrip } from './RuleStrip';

export type ListedRule = EditableRule & {
	source: string;
	sourceRef: string | null;
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
				<p className="rounded-md border border-rule border-dashed p-3 text-ink-soft text-sm">
					No rules yet. Add one below and figgy will start telling you when it is
					due.
				</p>
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
							<RuleStrip
								rule={{
									id: rule.ruleIds[0],
									ruleIds: rule.ruleIds,
									action: rule.action as never,
									monthMask: rule.monthMask,
									sourceMask: rule.monthMask,
									cadence: rule.cadence as never,
									altGroup: null,
									note: rule.note,
									shifted: false,
									isOverride: false,
								}}
								currentMonth={currentMonth}
							/>
							<span className="text-ink-soft text-sm">
								{summary(rule.monthMask)}
								{rule.alternatives && ' · one of these'}
								{rule.environmentKind && ` · ${rule.environmentKind} only`}
							</span>
							<span className="ml-auto flex items-center gap-2">
								<span
									className="text-ink-soft text-xs"
									title={rule.sourceRef ?? undefined}
								>
									{rule.source === 'seed'
										? rule.edited
											? 'from the spreadsheet, kept'
											: 'from the spreadsheet'
										: 'yours'}
								</span>
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
					className="min-h-11 rounded-md border border-palace-300 border-dashed px-4 text-palace-700 text-sm hover:bg-palace-50"
				>
					Add a rule
				</button>
			)}
		</div>
	);
}
