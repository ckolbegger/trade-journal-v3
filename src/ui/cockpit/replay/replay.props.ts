import type { TradeReplayView } from '../../../app/types.ts';
import { instrumentKey } from '../../../domain/instrument/index.ts';
import { isMarkLacking } from '../../calculation-words.ts';
import { shortDate } from '../../format.ts';
import { cardOf } from './cards.props.ts';
import { plotBaseOf, plotSessionOf } from './plot.props.ts';
import { marksGroup, readoutOf } from './readout.props.ts';
import type { ReadoutGroup, ReplayFrameSession, ReplayProps } from './replay.types.ts';
import { markerWords, sessionWords } from './session-words.props.ts';

// The adapter selects and formats finished values from the view; it works out no figure (ADR 0001, A256). This file is the assembly:
// the session's words, the stake sentence, the readout and the plot's props are built in their own files (A286).

// The view a screen passes to the drawer or the card, so only this adapter names the view's type (A216).
export type ReplayView = TradeReplayView;
type ViewSession = TradeReplayView['sessions'][number];

// What a screen adds to the view's own words: the plot component (Corridor in the app, a double in a test), the session to open on, and
// the call that keeps the slider's session.
export interface ReplayOptions {
  readonly Plot: ReplayProps['Plot'];
  readonly initialSession?: string;
  readonly onSessionChange?: (date: string) => void;
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
  const readout = readoutOf(view, session);
  return {
    date: session.date,
    dateLabel,
    sliderValue: `${dateLabel} · ${index + 1} of ${view.sessions.length}`,
    ...words,
    ...addMarkLinkOf(view, session),
    isFinal: session.final !== undefined,
    readout,
    card: cardOf(view, session, readout),
    plot: plotSessionOf(view, index),
    hover: hoverOf(session, marks, words.headline.figure),
    hasMarker: (session.markers ?? []).length > 0,
  };
}

// A255: the whole view as the frame's props, from finished values only; no figure is worked out here (ADR 0001, A256).
export function replayProps(view: TradeReplayView, { Plot, initialSession, onSessionChange }: ReplayOptions): ReplayProps {
  return {
    tradeKey: view.tradeId,
    sessions: view.sessions.map((_, index) => frameSessionOf(view, index)),
    ...(initialSession !== undefined && { initialSession }),
    sliderLabel: 'Session',
    previousLabel: 'Previous session',
    nextLabel: 'Next session',
    cardsWords: { title: 'Session by session', newerLabel: 'Newer sessions', earlierLabel: 'Earlier sessions' },
    plotBase: plotBaseOf(view),
    Plot,
    ...(onSessionChange && { onSessionChange }),
  };
}
