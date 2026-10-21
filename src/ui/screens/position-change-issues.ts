import type { EntryDefinitionRecord } from '../../app/types.ts';
import { describeJournalIssue, type FieldIssue, type Issue } from './plan-issues.ts';

// The field name of one value in one Execution row, stable while rows are added or removed.
export const rowField = (rowKey: number, field: string) => `row-${rowKey}-${field}`;

const DECIMAL: Record<string, string> = {
  quantity: 'enter a quantity greater than zero, with at most 6 decimal places.',
  price: 'enter a price greater than zero, with at most 6 decimal places.',
  fee: 'enter a fee of 0 or more, with at most 6 decimal places.',
};

const TIME: Record<string, string> = {
  EconomicTimeBeforePlan: 'the Economic Time cannot be before the Plan time.',
  EconomicTimeInFuture: 'the Economic Time cannot be in the future.',
  InvalidLocalTime: 'enter a date and time.',
};

function memberMessage(issue: Issue): string {
  if (issue.field === 'economicTime') return TIME[issue.code] ?? 'check the Economic Time.';
  if (issue.field === 'fee' && issue.code === 'Required') return 'enter the fee, or 0 if there was none.';
  return DECIMAL[issue.field ?? ''] ?? 'check this Execution.';
}

// Plain-language messages for every issue in a rejected entry, keyed to their row field, Prompt,
// or the decline reason. `rowKeys` maps each submitted member index to its row.
export function describePositionChangeIssues(
  issues: readonly (Issue & { readonly member?: number })[],
  rowKeys: readonly number[],
  definition: EntryDefinitionRecord,
): FieldIssue[] {
  return issues.map((issue): FieldIssue => {
    if (issue.member !== undefined) {
      return { field: rowField(rowKeys[issue.member]!, issue.field ?? ''), message: `Execution ${issue.member + 1}: ${memberMessage(issue)}` };
    }
    if (issue.code === 'ReasonTooLong') return { field: 'reason', message: 'Keep the reason for declining to 500 characters or fewer.' };
    return describeJournalIssue(issue, definition);
  });
}
