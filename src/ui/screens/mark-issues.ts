import type { MarketDataIssue } from '../../app/types.ts';
import type { FieldIssue } from './plan-issues.ts';

const MESSAGES: Record<string, string> = {
  PriceNegative: 'A price cannot be negative.',
  InvalidPrice: 'Enter a price as a number, with at most 6 decimal places.',
  ReasonRequired: 'Enter the reason for the correction.',
  ReasonTooLong: 'Keep the reason to 500 characters or fewer.',
  CorrectionUnchanged: 'That is already the Mark; enter a different price.',
  MarkExists: 'A Mark already exists for this date, so it cannot be marked unavailable.',
};

// Any other rejection (the state changed under the form, or the date or Instrument is not valid) is about the Mark as a whole.
const FALLBACK = 'This Mark could not be saved. Reopen it and try again.';

// Plain-language messages for a rejected Mark save, keyed to the form's field names (`price`,
// `reason`) or `key` for an issue about the Mark as a whole, each under the form's own prefix.
export function describeMarkIssues(issues: readonly MarketDataIssue[], prefix: string): FieldIssue[] {
  return issues.map((issue): FieldIssue => {
    const message = MESSAGES[issue.code];
    return message === undefined
      ? { field: `${prefix}-key`, message: FALLBACK, code: issue.code }
      : { field: `${prefix}-${issue.field}`, message, code: issue.code };
  });
}
