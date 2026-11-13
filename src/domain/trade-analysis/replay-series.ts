import { Temporal } from 'temporal-polyfill';
import { instrumentKey, type Instrument } from '../instrument/index.ts';
import type { Instant } from '../time/index.ts';
import type { CalculationResult } from '../calculation-result/index.ts';
import { parseDecimal, Rational } from '../values/index.ts';
import { evaluate, type ObservationFrame } from './evaluate.ts';
import { derive, type DerivedTradeState, type IncoherentFact, type TradeAnalysisRecord } from './derive.ts';

// A211: one completed session's Mark points, one frame per Instrument (Available, Missing or AcknowledgedUnavailable,
// never carried forward). Structurally what Market Data's series gives; Trade Analysis never imports it.
export interface ReplaySessionInput {
  readonly tradingDate: string;
  readonly closeInstant: Instant;
  readonly frames: readonly ObservationFrame[];
}

export interface ReplayInput {
  readonly record: TradeAnalysisRecord;
  // Completed sessions, oldest first.
  readonly sessions: readonly ReplaySessionInput[];
}

// A change since an earlier session, named by that session's date.
export interface ReplayChange {
  readonly since: string;
  readonly dollars: Rational;
}

export interface ReplayMark {
  readonly instrument: Instrument;
  readonly resolution: ObservationFrame['resolution'];
  // The Mark's price change since this Instrument's previous Mark; null when it has none or has no Mark now.
  readonly change: ReplayChange | null;
}

export interface ReplayedSession {
  readonly date: string;
  readonly positions: readonly { readonly instrument: Instrument; readonly quantity: Rational }[];
  readonly heldQuantity: Rational;
  readonly realizedPnl: Rational;
  readonly tradePnl: CalculationResult<Rational>;
  readonly change: ReplayChange | null;
  readonly marks: readonly ReplayMark[];
  readonly positionChangeIds: readonly string[];
}

export type ReplayResult =
  | { readonly kind: 'Replayed'; readonly sessions: readonly ReplayedSession[] }
  // A Planned or Abandoned Trade was never exposed.
  | { readonly kind: 'NotApplicable'; readonly reason: 'NeverExposed' }
  // The facts cannot be replayed: each finding describes itself (P69).
  | { readonly kind: 'NotApplicable'; readonly reason: 'FactsIncoherent'; readonly findings: readonly IncoherentFact[] };

const ZERO = Rational.of(0n);

export function replay(input: ReplayInput): ReplayResult {
  const whole = derive({ record: input.record });
  if (whole.kind !== 'Derived') return { kind: 'NotApplicable', reason: 'FactsIncoherent', findings: whole.findings };
  if (input.record.positionChanges.length === 0) return { kind: 'NotApplicable', reason: 'NeverExposed' };
  // The latest session so far with a Trade P&L figure: the next figure's change is measured from it (A211).
  let lastFigure: { readonly date: string; readonly value: Rational } | undefined;
  // Each Instrument's latest Available Mark so far: a gap is skipped, never filled.
  const lastMark = new Map<string, { readonly date: string; readonly price: Rational }>();
  const sessions = input.sessions.map((session, index): ReplayedSession => {
    // The Position at the session's close, valued with that session's own Marks (A211).
    const state = derive({ record: input.record, cutoff: session.closeInstant, valuationDate: session.tradingDate });
    if (state.kind !== 'Derived') throw new Error('facts cannot be replayed');
    const positions = state.positions.filter((p) => p.openLots.length > 0).map((p) => ({ instrument: p.instrument, quantity: p.quantity }));
    const tradePnl = tradePnlOf(state, session);
    const change = tradePnl.kind === 'Value' && lastFigure ? { since: lastFigure.date, dollars: tradePnl.value.sub(lastFigure.value) } : null;
    if (tradePnl.kind === 'Value') lastFigure = { date: session.tradingDate, value: tradePnl.value };
    // The Position Changes after the previous session's close, up to this one's.
    const previousClose = input.sessions[index - 1]?.closeInstant;
    const positionChangeIds = input.record.positionChanges
      .filter((pc) => (previousClose === undefined || Temporal.Instant.compare(pc.economicTime, previousClose) > 0) && Temporal.Instant.compare(pc.economicTime, session.closeInstant) <= 0)
      .map((pc) => pc.factId);
    return {
      date: session.tradingDate,
      positions,
      heldQuantity: positions.reduce((total, p) => total.add(p.quantity), ZERO),
      realizedPnl: state.realizedToDate,
      tradePnl,
      change,
      marks: session.frames.map((frame) => markOf(frame, lastMark)),
      positionChangeIds,
    };
  });
  return { kind: 'Replayed', sessions };
}

function markOf(frame: ObservationFrame, lastMark: Map<string, { readonly date: string; readonly price: Rational }>): ReplayMark {
  const { instrument, resolution } = frame;
  if (resolution.kind !== 'Available') return { instrument, resolution, change: null };
  const key = instrumentKey(instrument);
  const price = decimal(resolution.mark.price);
  const previous = lastMark.get(key);
  lastMark.set(key, { date: frame.tradingDate, price });
  return { instrument, resolution, change: previous ? { since: previous.date, dollars: price.sub(previous.price) } : null };
}

// Marks reaching analysis were validated when recorded, so their decimals parse.
function decimal(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`Invalid stored decimal: ${text}`);
  return parsed.value;
}

function tradePnlOf(state: DerivedTradeState, session: ReplaySessionInput): CalculationResult<Rational> {
  const held = state.positions.find((p) => p.openLots.length > 0)?.instrument;
  // Nothing held: the Trade P&L is what was realized, and no Mark is needed.
  if (!held) return { kind: 'Value', value: state.realizedToDate };
  const frame = session.frames.find((f) => instrumentKey(f.instrument) === instrumentKey(held))!;
  return evaluate({ state, frame }).currentMarkedPnl;
}
