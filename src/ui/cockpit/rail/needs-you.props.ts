import type { OpenTradeDetail, TradeDetailDebt, TradeDetailView } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { instrumentLabel, text, unavailableWords } from '../../calculation-words.ts';
import { DUE_TEXT } from '../../due-text.ts';
import { calculation, unavailableLabel } from '../../figures.ts';
import { decimalMoney, decimalUnderlyingPrice, quantity, shortDate } from '../../format.ts';
import { contractCount, settlementTime } from '../../screens/option-words.ts';
import { abs } from '../../screens/trade-detail/words.ts';
import type { ShellProps } from '../placeholder.ts';
import { crossingWords } from './conditions.props.ts';
import type { NeedsYouItem, NeedsYouProps } from './needs-you.types.ts';

// The adapter from a Detail view to the Needs you card's props (A216, W7, A217, A224): the only file of the card that reads `app/types`.
export interface NeedsYouOptions {
  readonly timeZone: string;
  // Whether authoritative writes are allowed: Reflect now and Record expiration are offered only then.
  readonly writable: boolean;
  // Selects the Journal drawer and opens that Debt's form on its card (A217).
  readonly onReflectNow?: (debtId: string) => void;
}

// An Outstanding Debt as the Journal draws it: its Entry Type and "Reflection owed", with its due status as text (absent outside session-policy
// coverage). Reflect now is offered only while Writable.
function debtItem(debt: TradeDetailDebt, options: NeedsYouOptions): NeedsYouItem {
  const { onReflectNow } = options;
  return {
    kind: 'Debt',
    id: debt.id,
    heading: `${debt.entryType} Reflection owed`,
    ...(debt.dueStatus && { dueText: DUE_TEXT[debt.dueStatus] }),
    ...(options.writable && onReflectNow && { onReflectNow: () => onReflectNow(debt.id) }),
  };
}

// "Stop breached: the option's Mark is $3.70, at or above $3.60" / "Target reached: MNO's Mark is 44.60, at or above 44.50": the Mark that crossed
// the condition, and the condition, in the Conditions card's words.
function alertItems(view: OpenTradeDetail): NeedsYouItem[] {
  const { plan } = view;
  const option = plan.legs[0]?.instrument.kind === 'Option';
  return view.current.evaluation.conditions.flatMap((condition): NeedsYouItem[] => {
    const { result } = condition;
    if (result.kind !== 'Value' || result.value.status === 'Active') return [];
    const { price } = result.value.evidence.mark;
    const structure = option && condition.kind === 'StructureValue';
    const subject = structure ? "the option's" : `${plan.underlying}'s`;
    const shown = option && !structure ? decimalUnderlyingPrice(price) : decimalMoney(price);
    return [{ kind: 'Alert', id: condition.id, text: `${condition.role} ${result.value.status.toLowerCase()}: ${subject} Mark is ${shown}, ${crossingWords(plan, condition)}` }];
  });
}

// The existing "Mark missing" link to the Review, for a Mark still missing at the Expected Mark Date. Before the first Marks nothing was held at
// that close, so no Mark is due for it: the note stands alone (T8P.28's field, as the Today drawer reads it).
function markMissingItems(view: OpenTradeDetail, timeZone: string): NeedsYouItem[] {
  const { evaluation, markResolution, firstMarksDue } = view.current;
  if (markResolution?.kind !== 'Missing' || firstMarksDue !== undefined) return [];
  const { instrument } = evaluation.observation;
  const sentence = text(unavailableWords({ reason: 'MarkMissing', instrument, date: evaluation.valuationDate }, 'sentence', timeZone));
  return [{ kind: 'MarkMissing', id: 'mark-missing', text: sentence, reviewTo: `/review?trade=${encodeURIComponent(view.tradeId)}&instrument=${encodeURIComponent(instrument.symbol)}` }];
}

// Before any Marks: the date Trade Views says the first ones arrive, read as stated and never inferred from the figures (revision 90, 91).
function noteItems(view: OpenTradeDetail): NeedsYouItem[] {
  const { firstMarksDue } = view.current;
  return firstMarksDue === undefined ? [] : [{ kind: 'Note', id: 'first-marks', text: `First Marks are due once the ${shortDate(firstMarksDue)} session ends.` }];
}

// A contract still held at or past its expiration date, due for settlement (rows 23.9 and 23.10), with the panel's existing words. Whether it was
// assigned or exercised is worded by the sign of its quantity, never by the Strategy (decision 88); Record expiration is an authoritative write, so
// it is offered only while Writable, and a date outside the market calendar has no settlement time to record at (D7 Q1).
function settlementItems(view: OpenTradeDetail, options: NeedsYouOptions): NeedsYouItem[] {
  const { settlement } = view;
  const first = settlement[0];
  if (!first) return [];
  const short = (item: (typeof settlement)[number]): boolean => item.quantity.compare(Rational.of(0n)) < 0;
  return [
    {
      kind: 'SettlementDue',
      id: 'settlement-due',
      // The calculation-words module owns the words "Settlement Due" (conflict K4).
      heading: unavailableLabel({ reason: 'SettlementDue', instrument: first.instrument, expiration: first.expiration }),
      rows: settlement.flatMap((item) => [
        { label: 'Contract', value: instrumentLabel(item.instrument) },
        { label: 'Quantity', value: `${short(item) ? 'Short' : 'Long'} ${contractCount(quantity(abs(item.quantity)))}` },
        { label: 'Expired', value: shortDate(item.expiration) },
        { label: 'Settlement time', value: calculation(item.settlementTime, (instant) => settlementTime(instant, options.timeZone)) },
      ]),
      notes: settlement.map((item) =>
        short(item)
          ? "If it was assigned, this release can't record the assignment yet, so this Trade stays open until a later release can."
          : "If it was exercised, this release can't record the exercise yet, so this Trade stays open until a later release can.",
      ),
      ...(options.writable && settlement.every((item) => item.settlementTime.kind === 'Value') && { recordExpirationTo: `/trades/${view.tradeId}/record-expiration` }),
    },
  ];
}

// An Open Detail has a current evaluation; a Planned, Closed or incoherent one has nothing to cross or wait for.
const isOpen = (view: TradeDetailView): view is OpenTradeDetail => 'current' in view && !('terminalDisposition' in view);

export function needsYouProps(view: TradeDetailView, options: NeedsYouOptions): NeedsYouProps {
  // A Planned Detail's entries carry no kind; they are all saved Entries.
  const debts = view.journal.filter((item): item is TradeDetailDebt => 'kind' in item && item.kind === 'Debt').map((debt) => debtItem(debt, options));
  if (!isOpen(view)) return { items: debts };
  // Once the contract is due for settlement its conditions are no longer measured, so the panel stands in for the rest.
  if (view.settlement.length > 0) return { items: [...debts, ...settlementItems(view, options)] };
  return { items: [...debts, ...alertItems(view), ...noteItems(view), ...markMissingItems(view, options.timeZone)] };
}

// The shell hands a card its view as `unknown` (ShellProps), since a component may not name `app/types`.
export const needsYouPropsOf = ({ view, timeZone = 'UTC' }: ShellProps, options: Omit<NeedsYouOptions, 'timeZone'>): NeedsYouProps | undefined =>
  view === undefined ? undefined : needsYouProps(view as TradeDetailView, { ...options, timeZone });
