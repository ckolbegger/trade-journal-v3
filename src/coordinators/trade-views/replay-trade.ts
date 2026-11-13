import { Temporal } from 'temporal-polyfill';
import { instrumentKey, type Instrument } from '../../domain/instrument/index.ts';
import type { ObservationFrame, ReplayedSession, ReplaySessionInput, TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import type { Instant } from '../../domain/time/index.ts';
import type { TradeNarrativeItem } from '../../modules/journal/index.ts';
import type { SeriesPoint } from '../../modules/market-data/index.ts';
import type { ReplayMarkResolution, TradeReplayView } from './replay-view.ts';

const before = (a: Instant, b: Instant) => Temporal.Instant.compare(a, b) < 0;

// Every Instrument the lifetime exposes, in the order the Mark rows show them: each option's Underlying, then the contracts
// in the order they were first exposed.
export function replayInstruments(analysis: TradeAnalysisRecord): readonly Instrument[] {
  const exposed = analysis.positionChanges.flatMap((pc) => [...pc.executions, ...(pc.settlements ?? [])].map((fact) => fact.instrument));
  const underlyings = exposed.flatMap((instrument): Instrument[] => (instrument.kind === 'Option' ? [{ kind: 'Stock', symbol: instrument.symbol }] : []));
  const byKey = new Map([...underlyings, ...exposed].map((instrument) => [instrumentKey(instrument), instrument]));
  return [...byKey.values()];
}

export const firstExposureOf = (analysis: TradeAnalysisRecord): Instant =>
  analysis.positionChanges.map((pc) => pc.economicTime).reduce((first, time) => (before(time, first) ? time : first));

// A resolution as Trade Analysis reads it. The series carries no revision identity, so the evidence names the revision by its
// Instrument, date and number: the figures use the price alone.
function frameOf(instrument: Instrument, point: SeriesPoint): ObservationFrame {
  const { tradingDate, closeInstant } = point;
  if (point.kind === 'Available') {
    const revisionId = `${instrumentKey(instrument)}@${tradingDate}#${point.revisionNumber}`;
    return { instrument, tradingDate, closeInstant, resolution: { kind: 'Available', mark: { revisionId, revisionNumber: point.revisionNumber, price: point.price } } };
  }
  return { instrument, tradingDate, closeInstant, resolution: { kind: point.kind } };
}

function resolutionOf(point: SeriesPoint | undefined): ReplayMarkResolution {
  if (point?.kind === 'Available') {
    const { price, revisionNumber, source, savedAt, reason } = point;
    return { kind: 'Available', mark: { price, revisionNumber, source, savedAt, ...(reason !== undefined && { correctionReason: reason }) } };
  }
  if (point?.kind === 'AcknowledgedUnavailable') return { kind: 'AcknowledgedUnavailable', acknowledgment: point.acknowledgment };
  return { kind: 'Missing' };
}

export interface ReplaySessions {
  readonly inputs: readonly ReplaySessionInput[];
  // Each session's series point per Instrument, in the Instruments' order.
  readonly points: readonly (readonly (SeriesPoint | undefined)[])[];
}

// The completed sessions of the lifetime, from the first session that closes at or after the first exposure. The sessions are
// Market Data's: the first Instrument's series names them, and every Instrument's point is read by date. A Trade closed by its
// facts ends at the first session closing at or after its terminal Position Change.
export function replaySessions(instruments: readonly Instrument[], series: readonly (readonly SeriesPoint[])[], firstExposure: Instant, terminalTime: Instant | null): ReplaySessions {
  const lifetime = (series[0] ?? []).filter((point) => !before(point.closeInstant, firstExposure));
  const end = terminalTime === null ? -1 : lifetime.findIndex((point) => !before(point.closeInstant, terminalTime));
  const sessions = end < 0 ? lifetime : lifetime.slice(0, end + 1);
  const points = sessions.map((session) => series.map((own) => own.find((point) => point.tradingDate === session.tradingDate)));
  const inputs = sessions.map(({ tradingDate, closeInstant }, i) => ({
    tradingDate,
    closeInstant,
    frames: instruments.map((instrument, j): ObservationFrame => {
      const point = points[i]![j];
      return point ? frameOf(instrument, point) : { instrument, tradingDate, closeInstant, resolution: { kind: 'Missing' } };
    }),
  }));
  return { inputs, points };
}

export interface PlacedJournal {
  readonly plan: readonly TradeNarrativeItem[];
  readonly sessions: readonly (readonly TradeNarrativeItem[])[];
  readonly pending: readonly TradeNarrativeItem[];
}

// A213: an item before the first exposure is the Plan's; a Daily Trade Review Action belongs to its Review Date's session; any
// other item to the first session closing at or after its moment time. After the newest completed session an item belongs to
// the session not yet ended, or, for a Trade that has ended, to its final session.
export function placeJournal(narrative: readonly TradeNarrativeItem[], sessions: readonly ReplaySessionInput[], firstExposure: Instant, ended: boolean): PlacedJournal {
  const plan: TradeNarrativeItem[] = [];
  const pending: TradeNarrativeItem[] = [];
  const perSession = sessions.map((): TradeNarrativeItem[] => []);
  const after = ended ? (perSession.at(-1) ?? pending) : pending;
  for (const item of narrative) {
    const reviewDate = item.kind === 'Entry' ? item.reviewDate : undefined;
    if (reviewDate !== undefined) {
      const index = sessions.findIndex((session) => session.tradingDate === reviewDate);
      const last = sessions.at(-1);
      const beyond = last === undefined || reviewDate > last.tradingDate;
      const own = beyond ? after : plan;
      (index >= 0 ? perSession[index]! : own).push(item);
      continue;
    }
    if (before(item.momentTime, firstExposure)) {
      plan.push(item);
      continue;
    }
    const index = sessions.findIndex((session) => !before(session.closeInstant, item.momentTime));
    (index >= 0 ? perSession[index]! : after).push(item);
  }
  return { plan, sessions: perSession, pending };
}

export function replayView(
  tradeId: string,
  instruments: readonly Instrument[],
  replayed: readonly ReplayedSession[],
  sessions: ReplaySessions,
  journal: PlacedJournal,
  pendingDate: string | undefined,
  ended: boolean,
): TradeReplayView {
  return {
    tradeId,
    instruments,
    sessions: replayed.map((session, i) => ({
      ...session,
      marks: session.marks.map((mark, j) => ({ ...mark, resolution: resolutionOf(sessions.points[i]![j]) })),
      journal: journal.sessions[i]!,
    })),
    plan: journal.plan,
    pending: ended || pendingDate === undefined ? null : { date: pendingDate, journal: journal.pending },
  };
}
