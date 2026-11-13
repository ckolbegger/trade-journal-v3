import type { NarrativeAnswer, OpenTradeDetail, PlannedTradeDetail } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { localTime, money, quantity, rMultiple } from '../../format.ts';
import { holdingText } from '../option-words.ts';

// Why an incoherent Trade offers no Record entry; the entry route shows the same words.
export const INCOHERENT_ENTRY_NOTE = 'New entries cannot be recorded for this Trade until its records agree.';

// The query parameter that opens the entry form as an exit: `/trades/:tradeId/record-entry?action=Sell`.
// Defined here, which the form already imports from, so the two screens do not import each other.
export const EXIT_ACTION = 'Sell';

export function answerText(answer: NarrativeAnswer): string {
  if (answer.kind === 'Text') return answer.text;
  if (answer.kind === 'Scale') return String(answer.value);
  if (answer.kind === 'Option') return answer.label;
  return 'Not answered';
}

export type PlannedLeg = PlannedTradeDetail['plan']['legs'][number];

// A Planned Leg in words: an option leg by contracts and contract (C2), a stock leg by shares.
export const legText = (leg: PlannedLeg): string =>
  leg.instrument.kind === 'Option' ? holdingText(leg.side, leg.quantity, leg.instrument) : `${leg.side} ${leg.quantity} shares of ${leg.instrument.symbol}`;

export const abs = (value: Rational): Rational => (value.compare(Rational.of(0n)) < 0 ? Rational.of(0n).sub(value) : value);

// An open position: an option by its direction, contracts and contract (23.4), a stock by shares.
export const positionText = (p: OpenTradeDetail['positions'][number]): string =>
  p.instrument.kind === 'Option'
    ? holdingText(p.quantity.compare(Rational.of(0n)) < 0 ? 'Short' : 'Long', quantity(abs(p.quantity)), p.instrument)
    : `${quantity(p.quantity)} shares of ${p.instrument.symbol}`;

export const measureText = (measure: { readonly dollars: Rational; readonly planR: Rational }) => `${money(measure.dollars)} · ${rMultiple(measure.planR)}`;

// A Position Change's Economic Time in the Workspace zone, which is how the Detail names it.
export function changeTime(view: OpenTradeDetail, positionChangeId: string, timeZone: string): string {
  return localTime(view.positionChanges.find((c) => c.factId === positionChangeId)?.economicTime ?? '', timeZone);
}

export type Evaluation = OpenTradeDetail['current']['evaluation'];
