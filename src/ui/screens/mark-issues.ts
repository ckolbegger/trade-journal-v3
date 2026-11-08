import type { Instrument } from '../../domain/instrument/index.ts';
import { isAfterExpirationIssue } from '../calculation-words.ts';
import { shortDate } from '../format.ts';
import type { FieldIssue } from './plan-issues.ts';

// The note beside every Mark price: a Mark may be exactly 0, for any Instrument (P27, A115).
export const ZERO_MARK_NOTE = '0 means it closed with no value';

// The part of a Market Data issue, single-key or one entry of a Marks save, that decides where and how it is shown.
interface MarkIssue {
  readonly field: string;
  readonly code: string;
}

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
// A contract's key is the one Instrument whose expiration date can be named in the message (row 24.7).
export function describeMarkIssues(issues: readonly MarkIssue[], prefix: string, instrument?: Instrument): FieldIssue[] {
  return issues.map((issue): FieldIssue => {
    // Market Data refuses a date after the contract's expiration: that is about the Mark as a whole, not a field.
    if (instrument?.kind === 'Option' && isAfterExpirationIssue(issue)) return { field: `${prefix}-key`, message: `This contract expired on ${shortDate(instrument.expiration)}, so it has no Mark for a later date.`, code: issue.code };
    const message = MESSAGES[issue.code];
    return message === undefined
      ? { field: `${prefix}-key`, message: FALLBACK, code: issue.code }
      : { field: `${prefix}-${issue.field}`, message, code: issue.code };
  });
}
