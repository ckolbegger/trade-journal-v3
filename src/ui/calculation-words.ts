import type { IncoherentFact, NotApplicableReason, UnavailableReason } from '../domain/calculation-result/index.ts';
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

export const instrumentLabel = (instrument: Instrument): string => instrument.symbol;
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

export const findingWords = (finding: IncoherentFact, timeZone: string): Parts => {
  if (finding.kind === 'PositionChange') {
    return [t('Position Change on '), ...timeParts(finding.economicTime, timeZone), t(' shares its identity with another record')];
  }
  const head: Parts = [
    t(`${finding.side} of ${recordedQuantity(finding.quantity)} `),
    instrumentPart(finding.instrument),
    t(' on '),
    ...timeParts(finding.economicTime, timeZone),
  ];
  switch (finding.reason) {
    case 'ExceedsOpenQuantity':
      return [...head, t(` is more than the ${quantity(finding.available)} shares open`)];
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
