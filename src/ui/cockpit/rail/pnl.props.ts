import { createElement } from 'react';
import type { ClosedTradeDetail, OpenTradeDetail, PlannedTradeDetail, TradeDetailView } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { calculation, closedViaSale, FACTS_INCOHERENT_FIGURE, settlementDueFigure, signed } from '../../figures.ts';
import { money, quantity, rMultiple, shortDate } from '../../format.ts';
import { closedViaOption, timingWords } from '../../screens/option-disposition.ts';
import { contractCount } from '../../screens/option-words.ts';
import { abs } from '../../screens/trade-detail/words.ts';
import { PnlCardView } from './pnl-card.tsx';
import type { PnlCardProps, Tone } from './pnl.types.ts';

// The slice of the replay this card reads (A211): each completed session's change in Trade P&L since the previous session with a figure,
// oldest first. It is declared here because a UI file may not import the coordinator's type; `TradeReplayView` is assignable to it.
export interface PnlReplay {
  readonly sessions: readonly { readonly change: { readonly since: string; readonly dollars: Rational } | null }[];
}

const ZERO = Rational.of(0n);
// The figure where there is none yet.
const NO_FIGURE = '—';

// A gain or a loss; a zero has neither.
const toneProps = <K extends string>(key: K, value: Rational): { readonly [P in K]?: Tone } => {
  const sign = value.compare(ZERO);
  if (sign === 0) return {};
  return { [key]: sign > 0 ? 'gain' : 'loss' } as { readonly [P in K]?: Tone };
};

// "1 of 2 contracts open", "100 of 100 shares open" (A221): what is held against what the Plan sets out to hold.
function openLineOf(view: PlannedTradeDetail | OpenTradeDetail): string {
  const leg = view.plan.legs[0];
  const held = 'heldQuantity' in view ? view.heldQuantity : ZERO;
  if (leg?.instrument.kind === 'Option') return `${quantity(abs(held))} of ${contractCount(leg.quantity)} open`;
  return `${quantity(held)} of ${leg?.quantity ?? ''} shares open`;
}

function openProps(view: OpenTradeDetail, replay: PnlReplay | undefined): Omit<PnlCardProps, 'name'> {
  const pnl = view.current.evaluation.currentMarkedPnl;
  const change = replay?.sessions.at(-1)?.change;
  // Before any Marks, Trade Views names the session whose close brings them (revision 90); the card infers nothing.
  const { firstMarksDue } = view.current;
  if (firstMarksDue !== undefined) return { figure: NO_FIGURE, line: `Trade P&L once the ${shortDate(firstMarksDue)} session ends`, openLine: openLineOf(view) };
  // A contract due for settlement has no figure: its reason names the contract, and the line says what the figure waits for.
  const due = view.settlement[0];
  if (due && pnl.kind === 'Unavailable') return { figure: settlementDueFigure(due), line: 'Trade P&L once the expiration is recorded' };
  return {
    figure: calculation(pnl, money),
    ...(pnl.kind === 'Value' && toneProps('tone', pnl.value)),
    ...(pnl.kind === 'Value' && change && { line: `${signed(money)(change.dollars)} since ${shortDate(change.since)}`, ...toneProps('lineTone', change.dollars) }),
    openLine: openLineOf(view),
  };
}

// A Closed Trade's realized P&L and its R, then how it ended in the Result rows' existing labels: no Mark stands behind them (A92).
function closedProps(view: ClosedTradeDetail): Omit<PnlCardProps, 'name'> {
  const side = view.plan.legs[0]?.instrument.kind === 'Option' ? view.plan.legs[0].side : undefined;
  const rows = [
    { label: 'Terminal Disposition', value: calculation(view.terminalDisposition, side ? (mechanisms) => closedViaOption(side, mechanisms) : closedViaSale) },
    ...(view.optionDispositionTiming ? [{ label: 'Option Disposition Timing', value: calculation(view.optionDispositionTiming, timingWords) }] : []),
    ...(view.closeReason ? [{ label: 'Close Reason', value: view.closeReason.label }] : []),
  ];
  return {
    figure: money(view.realizedToDate),
    ...toneProps('tone', view.realizedToDate),
    line: calculation(view.realizedR, (r) => `${signed(rMultiple)(r)} realized, final`),
    ...(view.realizedR.kind === 'Value' && toneProps('lineTone', view.realizedR.value)),
    result: rows,
  };
}

// The adapter from a Detail to the P&L card's plain props (A216, W3, W4). The change line needs the replay (T8P.22 passes it).
export function pnlProps(view: TradeDetailView, replay?: PnlReplay): PnlCardProps {
  return { name: 'Trade P&L', ...figuresOf(view, replay) };
}

function figuresOf(view: TradeDetailView, replay: PnlReplay | undefined): Omit<PnlCardProps, 'name'> {
  if ('recordedPositionChanges' in view) return { figure: FACTS_INCOHERENT_FIGURE, line: 'Trade P&L' };
  if ('terminalDisposition' in view) return closedProps(view);
  if ('current' in view) return openProps(view, replay);
  return { figure: NO_FIGURE, line: 'Trade P&L once the entry is recorded and marked', openLine: openLineOf(view) };
}

// The card the shell renders: the Detail's view in, the card's plain props out.
export function PnlCardFromView({ view, replay }: { readonly view: TradeDetailView; readonly timeZone: string; readonly replay?: PnlReplay }) {
  return createElement(PnlCardView, pnlProps(view, replay));
}
