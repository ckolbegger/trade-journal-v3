import { instrumentKey, instrumentOf, type Instrument } from '../../domain/instrument/index.ts';
import { derive, evaluate, type DerivedTradeState, type IncoherentFact, type TradeAnalysisRecord, type TradeEvaluation, type TradeEvaluationInput } from '../../domain/trade-analysis/index.ts';
import type { HistoricalGaps, MarkFrame, MarketDataReadSession } from '../../modules/market-data/index.ts';
import { datedCloseOf, datedLineOf, observationFrame, type DatedLine } from './dated-line.ts';
import type { SettlementItem } from './settlement.ts';

export interface ValuationOptions {
  // Count only the facts at or before the session's close (a Review), rather than every effective fact.
  readonly factsAtClose?: boolean;
  // Also list the required Instruments' gaps, as a session that recovers does.
  readonly withGaps?: boolean;
  // Leave the dated line out, and make no read for it: the Review's open shows none.
  readonly skipDatedLine?: boolean;
}

export type TradeValuation =
  | {
      readonly kind: 'Valued';
      readonly state: DerivedTradeState;
      readonly evaluation: TradeEvaluation;
      // The contracts still held at or past their expiration date, each with its settlement time.
      readonly settlement: readonly SettlementItem[];
      // Each required Instrument's Missing and Acknowledged-Unavailable sessions since its exposure began, when asked for.
      readonly gaps: readonly HistoricalGaps[];
      // The frame of the Instrument whose Mark values the Trade: the contract for an option, the Underlying for stock.
      // Absent when nothing was read: outside coverage, after expiration, or with no Position.
      readonly frame?: MarkFrame;
      // An option's Underlying frame, paired for condition status and risk to the Stop (A110).
      readonly underlyingFrame?: MarkFrame;
      // The Position held at an earlier close, valued with that session's own exact Mark (P13, A54); absent when the
      // current figures need no such line.
      readonly datedLine?: DatedLine;
    }
  // The facts cannot be replayed: no figure exists, and nothing was read (P80).
  | { readonly kind: 'Unavailable'; readonly reason: 'FactsIncoherent'; readonly findings: readonly IncoherentFact[] };

type Observation = TradeEvaluationInput['frame'];

// What the evaluation takes, and the Market Data frames behind it when any was read.
interface Observations {
  readonly frame: Observation;
  readonly underlyingFrame?: Observation;
  readonly read?: { readonly frame: MarkFrame; readonly underlyingFrame?: MarkFrame };
}

// The frames the evaluation needs, from what `derive` requires at the session's date (P81).
async function observationsOf(session: MarketDataReadSession, state: DerivedTradeState, analysis: TradeAnalysisRecord): Promise<Observations> {
  const required = state.observationRequirements.map((r) => r.instrument);
  const contract = required.find((i) => i.kind === 'Option');
  // After its expiration date a contract requires no Mark, so none is read: the evaluation answers Settlement Due from a
  // frame at the session's own date and close that holds no Mark (A110).
  const expired = state.contractStatuses.find((s) => s.status === 'PastExpiration')?.instrument;
  const primary = contract ?? required[0] ?? expired;
  // No Position to value: nothing is read.
  if (!primary) return unreadObservations(state, analysis);
  const underlying: Instrument | undefined = primary.kind === 'Option' ? { kind: 'Stock', symbol: primary.symbol } : undefined;
  if (!session.covered) return unreadObservations(state, analysis);
  if (required.length === 0) {
    const missing = (instrument: Instrument): Observation => ({ instrument, tradingDate: session.tradingDate, closeInstant: session.closeInstant!, resolution: { kind: 'Missing' } });
    return { frame: missing(primary), ...(underlying && { underlyingFrame: missing(underlying) }) };
  }
  const frames = await session.frames([...new Set(required.map(instrumentKey))]);
  const frameOf = (instrument: Instrument) => frames.find((f) => f.instrumentKey === instrumentKey(instrument))!;
  const read = { frame: frameOf(primary), ...(underlying && { underlyingFrame: frameOf(underlying) }) };
  return { frame: observationFrame(read.frame), ...(read.underlyingFrame && { underlyingFrame: observationFrame(read.underlyingFrame) }), read };
}

// Observations at the state's valuation date that name no frame: outside coverage no Mark could apply (P80), and a Trade
// holding nothing needs none, so every Mark-dependent figure is NotApplicable(NoRemainingPosition) whatever the date (A92).
function unreadObservations(state: DerivedTradeState, analysis: TradeAnalysisRecord): Observations {
  const instrument: Instrument = state.positions[0]?.instrument ?? { kind: 'Stock', symbol: analysis.plan.underlying };
  const date = state.valuationDate!;
  return { frame: { instrument, date }, ...(instrument.kind === 'Option' && { underlyingFrame: { instrument: { kind: 'Stock', symbol: instrument.symbol }, date } }) };
}

export async function valueTrade(session: MarketDataReadSession, analysis: TradeAnalysisRecord, options: ValuationOptions = {}): Promise<TradeValuation> {
  // A Review's facts end at the session's close; without one, deriving over every fact would count facts after the Review date.
  if (options.factsAtClose && !session.closeInstant) throw new Error('valueTrade: factsAtClose needs a session with a close');
  const open = derive({ record: analysis, ...(options.factsAtClose && { cutoff: session.closeInstant }), valuationDate: session.tradingDate });
  if (open.kind !== 'Derived') return { kind: 'Unavailable', reason: 'FactsIncoherent', findings: open.findings };
  if (analysis.storedLifecycle === 'Closed' && open.expectedLifecycle === 'Closed') {
    const state = derive({ record: analysis, valuationDate: open.terminalTime!.slice(0, 10) });
    if (state.kind !== 'Derived') return { kind: 'Unavailable', reason: 'FactsIncoherent', findings: state.findings };
    // A Closed Trade is valued at its terminal date, with no session read (A92, P80).
    const { frame, underlyingFrame } = unreadObservations(state, analysis);
    return { kind: 'Valued', state, evaluation: evaluate({ state, frame, ...(underlyingFrame && { underlyingFrame }) }), settlement: [], gaps: [] };
  }
  const state = open;
  // Asked together, the frames and the gaps share the date's read snapshot, as `recover`'s do (A193).
  const [{ frame, underlyingFrame, read }, gaps] = await Promise.all([
    observationsOf(session, state, analysis),
    options.withGaps ? session.gaps(state.observationRequirements.map((r) => ({ instrumentKey: instrumentKey(r.instrument), earliestExposure: r.earliestRelevance }))) : [],
  ]);
  const evaluation = evaluate({ state, frame, ...(underlyingFrame && { underlyingFrame }) });
  const datedLine = read && !options.skipDatedLine && (await datedLineFor(session, analysis, read.frame, evaluation));
  return { kind: 'Valued', state, evaluation, settlement: await settlementOf(session, analysis.tradeId, evaluation), gaps, ...read, ...(datedLine && { datedLine }) };
}

// A stock's dated line comes from its own frame. An option's comes from the contract's frame and the Underlying's frame at that
// same dated close (decision 97), whatever the Underlying's state on the session's date (A110); an option whose Underlying has no
// frame there, as outside session-policy coverage, has no dated line.
async function datedLineFor(session: MarketDataReadSession, analysis: TradeAnalysisRecord, frame: MarkFrame, evaluation: TradeEvaluation): Promise<DatedLine | undefined> {
  const contract = instrumentOf(frame.instrumentKey);
  if (contract.kind === 'Stock') return datedLineOf(analysis, frame, evaluation);
  const date = datedCloseOf(frame, evaluation);
  if (date === undefined) return undefined;
  const [underlyingFrame] = await session.historicalFrames(date, [contract.symbol]);
  return underlyingFrame && datedLineOf(analysis, frame, evaluation, underlyingFrame);
}

// The contracts the evaluation finds Due, each with its settlement time from the session's calendar (A111).
function settlementOf(session: MarketDataReadSession, tradeId: string, evaluation: TradeEvaluation): Promise<SettlementItem[]> {
  const due = evaluation.settlement.filter((item) => item.status === 'Due');
  return Promise.all(due.map(async ({ instrument, quantity, expiration }) => ({ tradeId, instrument, quantity, expiration, settlementTime: await session.settlementTime(instrument) })));
}
