import type { EntryDefinitionRecord } from '../../app/types.ts';
import type { Rational } from '../../domain/values/index.ts';
import type { OptionInstrument } from '../../domain/instrument/index.ts';
import { isAfterExpirationIssue, isContractQuantityNotWholeIssue, isExceedsOpenQuantityIssue, isFlatBeforeLaterFactsIssue } from '../calculation-words.ts';
import { quantity, shortDate } from '../format.ts';
import { AMBIGUOUS_TIME, NONEXISTENT_TIME } from './local-time.ts';
import { describeJournalIssue, type FieldIssue, type Issue } from './plan-issues.ts';

// The field name of one value in one Execution row, stable while rows are added or removed.
export const rowField = (rowKey: number, field: string) => `row-${rowKey}-${field}`;

export const REASON_TOO_LONG = 'Keep the reason for declining to 500 characters or fewer.';

const DECIMAL: Record<string, string> = {
  quantity: 'enter a quantity greater than zero, with at most 6 decimal places.',
  price: 'enter a price greater than zero, with at most 6 decimal places.',
  fee: 'enter a fee of 0 or more, with at most 6 decimal places.',
};

const TIME: Record<string, string> = {
  EconomicTimeBeforePlan: 'the Economic Time cannot be before the Plan time.',
  EconomicTimeInFuture: 'the Economic Time cannot be in the future.',
  InvalidLocalTime: 'enter a date and time.',
  NonexistentLocalTime: `the Economic Time ${NONEXISTENT_TIME}`,
  AmbiguousLocalTime: `the Economic Time ${AMBIGUOUS_TIME}`,
};

// An issue about the change's position path (P22), with the quantity open where one is named.
type PathIssue = Issue & { readonly member?: number; readonly available?: Rational };

function memberMessage(issue: PathIssue, option: OptionInstrument | undefined): string {
  if (isExceedsOpenQuantityIssue(issue)) {
    const [one, many] = option ? ['contract', 'contracts'] : ['share', 'shares'];
    return issue.available ? `The position has only ${quantity(issue.available)} ${quantity(issue.available) === '1' ? one : many}.` : `more ${many} than the position has.`;
  }
  if (isFlatBeforeLaterFactsIssue(issue)) return 'this exit would leave the Position flat before a later recorded change.';
  if (option && issue.field === 'quantity') return isContractQuantityNotWholeIssue(issue) ? 'enter a whole number of contracts.' : 'enter a number of contracts greater than zero.';
  if (option && isAfterExpirationIssue(issue)) return `the Economic Time cannot be after the expiration date, ${shortDate(option.expiration)}.`;
  if (issue.field === 'economicTime') return TIME[issue.code] ?? 'check the Economic Time.';
  if (issue.field === 'fee' && issue.code === 'Required') return 'enter the fee, or 0 if there was none.';
  return DECIMAL[issue.field ?? ''] ?? 'check this Execution.';
}

// Plain-language messages for every issue in a rejected entry, keyed to their row field, Prompt,
// or the decline reason. `rowKeys` maps each submitted member index to its row.
export function describePositionChangeIssues(
  issues: readonly PathIssue[],
  rowKeys: readonly number[],
  definition: EntryDefinitionRecord,
  // The exit form's Close Review definition, whose Prompts the Close Review's issues name (D6 P21).
  closeDefinition?: EntryDefinitionRecord,
  // The Trade's leg when it is an option, so counts are words of contracts rather than shares.
  option?: OptionInstrument,
): FieldIssue[] {
  return issues.map((issue): FieldIssue => ({ ...describeIssue(issue, rowKeys, definition, closeDefinition, option), code: issue.code }));
}

// The close-requirement issues of the Closing the Trade section, by code (D6 A77, A93).
const CLOSE: Record<string, FieldIssue> = {
  CloseReasonRequired: { field: 'closeReasonId', message: 'Choose a Close Reason.' },
  CloseReviewDispositionRequired: { field: 'closeReview', message: 'Choose how to meet the Close Review.' },
  CloseReasonNotApplicable: { field: 'closeReasonId', message: 'This exit does not close the Trade, so it takes no Close Reason.' },
  CloseReviewNotApplicable: { field: 'closeReview', message: 'This exit does not close the Trade, so it has no Close Review.' },
};

function describeIssue(issue: PathIssue, rowKeys: readonly number[], definition: EntryDefinitionRecord, closeDefinition: EntryDefinitionRecord | undefined, option: OptionInstrument | undefined): FieldIssue {
  if (issue.member !== undefined) {
    return { field: rowField(rowKeys[issue.member]!, issue.field ?? ''), message: `Execution ${issue.member + 1}: ${memberMessage(issue, option)}` };
  }
  if (issue.source === 'TradeAnalysis' && (isExceedsOpenQuantityIssue(issue) || isFlatBeforeLaterFactsIssue(issue))) {
    return { field: 'members', message: `This exit would leave a later recorded exit without enough ${option ? 'contracts' : 'shares'} in the position.` };
  }
  if (issue.code === 'TradeClosed') return { field: 'trade', message: 'This Trade is closed. New exposure needs a new Plan.' };
  if (issue.source === 'TradeWorkflows' && CLOSE[issue.code]) return CLOSE[issue.code]!;
  if (issue.source === 'ReferenceCatalog' && issue.field === 'closeReasonId') {
    return { field: 'closeReasonId', message: 'Choose one of the available Close Reasons.' };
  }
  if (issue.field === 'closeReview' && issue.code === 'ReasonTooLong') return { field: 'closeReviewReason', message: REASON_TOO_LONG };
  if (closeDefinition?.prompts.some((p) => p.id === issue.field)) return describeJournalIssue(issue, closeDefinition);
  if (issue.code === 'ReasonTooLong') return { field: 'reason', message: REASON_TOO_LONG };
  return describeJournalIssue(issue, definition);
}
