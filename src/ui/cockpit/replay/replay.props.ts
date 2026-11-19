import type { TradeReplayView } from '../../../app/types.ts';
import type { CalculationResult } from '../../../domain/calculation-result/index.ts';
import { instrumentKey } from '../../../domain/instrument/index.ts';
import { Rational } from '../../../domain/values/index.ts';
import { isMarkLacking } from '../../calculation-words.ts';
import { calculation, signed } from '../../figures.ts';
import { decimalMoney, decimalUnderlyingPrice, money, shortDate } from '../../format.ts';
import { instrumentsOf, plotBaseOf, plotSessionOf } from './plot.props.ts';
import { marksGroup, readoutOf } from './readout.props.ts';
import type { ReadoutGroup, ReplayFrameSession, ReplayProps, TableRow } from './replay.types.ts';
import { markerWords, sessionWords } from './session-words.props.ts';

// The adapter selects and formats finished values from the view; it works out no figure (ADR 0001, A256). This file is the assembly:
// the session's words, the stake sentence, the readout and the plot's props are built in their own files (A286).

// The view a screen passes to the drawer or the card, so only this adapter names the view's type (A216).
export type ReplayView = TradeReplayView;
type ViewSession = TradeReplayView['sessions'][number];

const ZERO = Rational.of(0n);

// What a screen adds to the view's own words: the plot component (Corridor in the app, a double in a test), the session to open on, and
// the call that keeps the slider's session.
export interface ReplayOptions {
  readonly Plot: ReplayProps['Plot'];
  readonly initialSession?: string;
  readonly onSessionChange?: (date: string) => void;
}

const signedMoney = signed(money);

// A table cell (W45): the figure alone, or "No Mark" for a session without one; never a value carried over from another session.
const cellOf = (result: CalculationResult<Rational> | undefined, format: (value: Rational) => string, marked: boolean): string => (marked ? (result ? calculation(result, format) : '') : 'No Mark');

// The trigger of a session's Stop or Target; an Underlying's price has no "$" on an option Trade (C3).
function triggerOf(view: TradeReplayView, session: ViewSession, role: 'Stop' | 'Target'): string {
  const condition = session.figures?.conditions.find((c) => c.role === role);
  if (!condition) return '';
  const bare = condition.kind === 'UnderlyingPrice' && view.instruments.some((i) => i.kind === 'Option');
  return bare ? decimalUnderlyingPrice(condition.boundary) : decimalMoney(condition.boundary);
}

function tableRowOf(view: TradeReplayView, session: ViewSession, marks: ReadoutGroup): TableRow {
  const f = session.figures;
  const marked = session.tradePnl.kind === 'Value';
  return {
    dateLabel: shortDate(session.date),
    cells: [
      ...marks.rows.map((r) => r.value.text),
      cellOf(session.tradePnl, signedMoney, marked),
      session.realizedPnl.compare(ZERO) !== 0 ? signedMoney(session.realizedPnl) : '',
      // The results, the Worst case and the Max reward read no Mark (A248), so they stand on a session without one.
      cellOf(f?.ongoingRiskToStop, money, marked),
      cellOf(f?.outcomes?.atStop, signedMoney, marked || f?.outcomes?.atStop.kind === 'Value'),
      cellOf(f?.worstCaseOngoingRisk, money, marked || f?.worstCaseOngoingRisk.kind === 'Value'),
      cellOf(f?.outcomes?.atWorstCase, signedMoney, marked || f?.outcomes?.atWorstCase.kind === 'Value'),
      cellOf(f?.incrementalRewardToTarget, money, marked),
      cellOf(f?.outcomes?.atTarget, signedMoney, marked || f?.outcomes?.atTarget.kind === 'Value'),
      // No cap, so nothing to end at: the readout's words, and an empty cell.
      f?.maximumIncrementalReward.kind === 'Unbounded' ? 'No cap above' : cellOf(f?.maximumIncrementalReward, money, marked || f?.maximumIncrementalReward.kind === 'Value'),
      f?.maximumIncrementalReward.kind === 'Unbounded' ? '' : cellOf(f?.outcomes?.atMaxReward, signedMoney, marked || f?.outcomes?.atMaxReward.kind === 'Value'),
      triggerOf(view, session, 'Stop'),
      triggerOf(view, session, 'Target'),
    ],
    events: (session.markers ?? []).map(markerWords),
  };
}

// What the hover and focus show (a short card): the date, each Mark, each Execution and the Trade P&L.
function hoverOf(session: ViewSession, marks: ReadoutGroup, pnl: string | undefined): string[] {
  return [shortDate(session.date), ...marks.rows.map((r) => `${r.label}: ${r.value.text}`), ...(session.markers ?? []).map(markerWords), `Trade P&L: ${pnl ?? 'No Mark'}`];
}

// A281: "Add the Mark" links to the Review's Marks row for the Instrument whose Mark is missing or acknowledged unavailable, as Needs you's
// link does, and only while the Trade is Open (a Trade that has ended has no pending session).
function addMarkLinkOf(view: TradeReplayView, session: ViewSession): Pick<ReplayFrameSession, 'addMarkTo'> {
  const { tradePnl } = session;
  if (view.pending === null || tradePnl.kind !== 'Unavailable' || !isMarkLacking(tradePnl)) return {};
  return { addMarkTo: `/review?trade=${encodeURIComponent(view.tradeId)}&instrument=${encodeURIComponent(instrumentKey(tradePnl.instrument))}` };
}

function frameSessionOf(view: TradeReplayView, index: number): ReplayFrameSession {
  const session = view.sessions[index]!;
  const dateLabel = shortDate(session.date);
  const words = sessionWords(view, index);
  const marks = marksGroup(view, session);
  return {
    date: session.date,
    dateLabel,
    sliderValue: `${dateLabel} · ${index + 1} of ${view.sessions.length}`,
    ...words,
    ...addMarkLinkOf(view, session),
    isFinal: session.final !== undefined,
    readout: readoutOf(view, session),
    tableRow: tableRowOf(view, session, marks),
    plot: plotSessionOf(view, index),
    hover: hoverOf(session, marks, words.headline.figure),
    hasMarker: (session.markers ?? []).length > 0,
  };
}

// A255: the whole view as the frame's props, from finished values only; no figure is worked out here (ADR 0001, A256).
export function replayProps(view: TradeReplayView, { Plot, initialSession, onSessionChange }: ReplayOptions): ReplayProps {
  const { underlying, contract } = instrumentsOf(view);
  return {
    tradeKey: view.tradeId,
    sessions: view.sessions.map((_, index) => frameSessionOf(view, index)),
    ...(initialSession !== undefined && { initialSession }),
    sliderLabel: 'Session',
    previousLabel: 'Previous session',
    nextLabel: 'Next session',
    tableTitle: 'Session by session',
    tableColumns: [`${underlying} Mark`, ...(contract ? [`${contract.right} Mark`] : []), 'Trade P&L', 'Banked', 'Current Risk at Stop', 'P&L at Stop', 'Current Risk at Worst case', 'P&L at Worst case', 'Remaining Reward at Target', 'P&L at Target', 'Remaining Reward at Max reward', 'P&L at Max reward', 'Stop', 'Target'],
    plotBase: plotBaseOf(view),
    Plot,
    ...(onSessionChange && { onSessionChange }),
  };
}
