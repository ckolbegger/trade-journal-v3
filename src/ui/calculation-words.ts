import type { IncoherentFact, NotApplicableReason, UnavailableReason } from '../domain/calculation-result/index.ts';
import type { IncompleteReason } from '../app/types.ts';
import type { Instrument } from '../domain/instrument/index.ts';
import { toWorkspaceLocal } from '../domain/time/index.ts';
import { parseDecimal } from '../domain/values/index.ts';
import { quantity, shortDate } from './format.ts';

export type WordLength = 'label' | 'figure' | 'sentence';
export type Part =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'instrument'; readonly instrument: Instrument }
  | { readonly kind: 'date'; readonly date: string };
export type Parts = readonly Part[];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "20 Nov 2026" from an ISO date.
const dayMonthYear = (date: string): string => {
  const [year = '', month = '1', day = '1'] = date.split('-');
  return `${Number(day)} ${SHORT_MONTHS[Number(month) - 1]} ${year}`;
};
// The only code that names an Instrument in text.
export const instrumentLabel = (instrument: Instrument): string =>
  instrument.kind === 'Option'
    ? `${instrument.symbol} ${dayMonthYear(instrument.expiration)} ${instrument.strike} ${instrument.right}`
    : instrument.symbol;
const partText = (part: Part): string => {
  switch (part.kind) {
    case 'text':
      return part.text;
    case 'instrument':
      return instrumentLabel(part.instrument);
    case 'date':
      return shortDate(part.date);
    default:
      return part satisfies never;
  }
};
export const text = (parts: Parts): string => parts.map(partText).join('');

const t = (value: string): Part => ({ kind: 'text', text: value });
const instrumentPart = (instrument: Instrument): Part => ({ kind: 'instrument', instrument });
const datePart = (date: string): Part => ({ kind: 'date', date });

export const unavailableWords = (reason: UnavailableReason, length: WordLength, timeZone: string): Parts => {
  switch (reason.reason) {
    case 'MarkMissing':
      if (length === 'label') return [t('Mark missing')];
      if (length === 'figure') return [t('Mark missing: '), instrumentPart(reason.instrument), t(', '), datePart(reason.date)];
      return [t('Mark missing for '), instrumentPart(reason.instrument), t(' on '), datePart(reason.date)];
    case 'AcknowledgedUnavailable':
      if (length === 'label') return [t('Acknowledged unavailable')];
      if (length === 'figure') return [t('Acknowledged unavailable: '), instrumentPart(reason.instrument), t(', '), datePart(reason.date)];
      return [t('Mark acknowledged unavailable for '), instrumentPart(reason.instrument), t(' on '), datePart(reason.date)];
    case 'AwaitingClose':
      if (length === 'label') return [t('Awaiting close')];
      if (length === 'figure') return [t('Awaiting the close after '), datePart(reason.after)];
      return [t('Awaiting the next close after '), datePart(reason.after)];
    case 'SettlementDue':
      if (length === 'label') return [t('Settlement Due')];
      if (length === 'figure') return [t('Settlement Due: '), instrumentPart(reason.instrument)];
      return [t('Settlement Due for '), instrumentPart(reason.instrument), t(', which expired '), datePart(reason.expiration)];
    case 'SessionPolicyNotCovered':
      if (length === 'label') return [t('Outside calendar')];
      if (length === 'figure') return [t('Outside the market calendar: '), datePart(reason.date)];
      return [datePart(reason.date), t(' is outside the market calendar')];
    case 'FactsIncoherent': {
      if (length === 'label') return [t("Facts can't be replayed")];
      if (length === 'figure') return [t('Not available')];
      const [first, ...rest] = reason.findings;
      if (!first) return [t("Facts can't be replayed")];
      return rest.length === 0 ? findingWords(first, timeZone) : [...findingWords(first, timeZone), t(` and ${rest.length} more`)];
    }
    default:
      return reason satisfies never;
  }
};
const notApplicableTail = (reason: NotApplicableReason): string => {
  switch (reason.reason) {
    case 'NoRemainingPosition':
      return 'no open position';
    case 'NoOptionExpirationAnchor':
      return 'no option expiration';
    case 'NotClosed':
      return 'not closed yet';
    case 'EntryNotResolved':
      return 'entry not resolved yet';
    case 'NoOngoingRisk':
      return 'no risk to the Stop';
    case 'EntryAtOrBeyondStop':
      return 'entry at or beyond the Stop';
    case 'EntryAtOrBeyondTarget':
      return 'entry at or beyond the Target';
    case 'NonPositiveAtEntry':
      return reason.side === 'Losing' ? 'no risk at entry' : 'no reward at entry';
    default:
      return reason satisfies never;
  }
};

export const notApplicableWords = (reason: NotApplicableReason, length: WordLength): Parts =>
  length === 'label' ? [t('Not applicable')] : [t(`Not applicable: ${notApplicableTail(reason)}`)];
// A finding's time: its Economic Time in the trader's zone, as the short date (a date part), then ", HH:mm".
const timeParts = (economicTime: string, timeZone: string): Parts => {
  const [date = '', clock = ''] = toWorkspaceLocal(economicTime, timeZone).split('T');
  return [datePart(date), t(`, ${clock}`)];
};

// The recorded quantity as entered; a stored decimal reads back through the one Quantity format.
const recordedQuantity = (recorded: string): string => {
  const parsed = parseDecimal(recorded);
  return parsed.ok ? quantity(parsed.value) : recorded;
};

// C1: the singular at exactly 1, in the one Quantity format.
const isOne = (available: Parameters<typeof quantity>[0]): boolean => quantity(available) === '1';
const plural1 = (available: Parameters<typeof quantity>[0], one: string, many: string): string => (isOne(available) ? one : many);

export const findingWords =(finding: IncoherentFact, timeZone: string): Parts => {
  if (finding.kind === 'PositionChange') {
    return [t('Position Change on '), ...timeParts(finding.economicTime, timeZone), t(' shares its identity with another record')];
  }
  if (finding.kind === 'Expiration') {
    const expirationHead: Parts = [t(`Expiration of ${recordedQuantity(finding.quantity)} `), instrumentPart(finding.instrument), t(' at '), ...timeParts(finding.economicTime, timeZone)];
    switch (finding.reason) {
      case 'ExpirationMustSettleAllOpen':
        return [...expirationHead, t(isOne(finding.available) ? " doesn't settle the 1 contract in the position" : ` doesn't settle all ${quantity(finding.available)} contracts in the position`)];
      case 'SettlementTimeInvalid':
        return [...expirationHead, t(" is dated after the contract's expiration or before an Execution on it")];
      case 'NotAnOption':
        return [...expirationHead, t(' names a stock, not an option')];
      case 'DuplicateFactId':
        return [...expirationHead, t(' shares its identity with another record')];
      case 'NonpositiveQuantity':
        return [...expirationHead, t(" has a quantity that isn't positive")];
      default:
        return finding satisfies never;
    }
  }
  const head: Parts = [
    t(`${finding.side} of ${recordedQuantity(finding.quantity)} `),
    instrumentPart(finding.instrument),
    t(' on '),
    ...timeParts(finding.economicTime, timeZone),
  ];
  switch (finding.reason) {
    case 'ExceedsOpenQuantity':
      return [...head, t(` is more than the ${quantity(finding.available)} ${finding.instrument.kind === 'Option' ? plural1(finding.available, 'contract', 'contracts') : plural1(finding.available, 'share', 'shares')} in the position`)];
    case 'AfterExpiration':
      return [...head, t(" is dated after the contract's expiration")];
    case 'ContractQuantityNotWhole':
      return [...head, t(" isn't a whole number of contracts")];
    case 'FlatBeforeLaterFacts':
      return [...head, t(' leaves the Position flat before later records')];
    case 'UnknownPlannedLeg':
      return [...head, t(" names a Planned Leg that isn't in the Plan")];
    case 'NonpositiveQuantity':
      return [...head, t(" has a quantity that isn't positive")];
    case 'DuplicateFactId':
      return [...head, t(' shares its identity with another record')];
    default:
      return finding satisfies never;
  }
};
// One text at every length.
export const unboundedWords = (direction: 'Above' | 'Below'): Parts => [t(direction === 'Above' ? 'Unbounded above' : 'Unbounded below')];

// The one place a screen asks which reason a result or a Review blocker holds (P74): a screen branches on these, never on a reason code.
type MarkMissingReason = Extract<UnavailableReason, { readonly reason: 'MarkMissing' }>;
type MarkLackingReason = Extract<UnavailableReason, { readonly reason: 'MarkMissing' | 'AcknowledgedUnavailable' }>;
// The result lacks the Mark it needs.
export const isMarkMissing = <R extends UnavailableReason>(reason: R): reason is Extract<R, MarkMissingReason> => reason.reason === 'MarkMissing';
// The result lacks its Mark, or the trader acknowledged that none can be had.
export const isMarkLacking = <R extends UnavailableReason>(reason: R): reason is Extract<R, MarkLackingReason> => reason.reason === 'MarkMissing' || reason.reason === 'AcknowledgedUnavailable';
// A Review blocker for a Mark that is missing.
export const isMarkMissingBlocker = (blocker: IncompleteReason): blocker is Extract<IncompleteReason, { readonly code: 'MarkMissing' }> => blocker.code === 'MarkMissing';

// Market Data's Expected-Mark Status as the Mark row shows it (section 1.1: unchanged text, its own casing).
export const acknowledgedUnavailableStatusLabel = (): string => 'Acknowledged Unavailable';
// The Position Change form's validation issue codes, which the form words in its own messages.
export const isExceedsOpenQuantityIssue = (issue: { readonly code: string }): boolean => issue.code === 'ExceedsOpenQuantity';
export const isFlatBeforeLaterFactsIssue = (issue: { readonly code: string }): boolean => issue.code === 'FlatBeforeLaterFacts';
export const isExpirationMustSettleAllOpenIssue = (issue: { readonly code: string }): boolean => issue.code === 'ExpirationMustSettleAllOpen';
export const isSettlementTimeInvalidIssue = (issue: { readonly code: string }): boolean => issue.code === 'SettlementTimeInvalid';
export const isAfterExpirationIssue =(issue: { readonly code: string }): boolean => issue.code === 'AfterExpiration';
export const isContractQuantityNotWholeIssue = (issue: { readonly code: string }): boolean => issue.code === 'ContractQuantityNotWhole';
