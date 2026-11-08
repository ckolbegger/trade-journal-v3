import type { OptionInstrument } from '../domain/instrument/index.ts';
import type { Instant } from '../domain/time/index.ts';
import type { CalculationResult, UnavailableReason } from '../domain/calculation-result/index.ts';
import { expirationPayoff, type DerivedTradeState, type ExpirationPayoffs, type TradeAnalysisRecord } from '../domain/trade-analysis/index.ts';
import type { Rational } from '../domain/values/index.ts';
import type { MarketData } from '../modules/market-data/index.ts';

// One option contract an eligible Trade still holds at or past its expiration date (A111, A112). The signed open
// quantity is negative for a short contract: the screen words the assignment or exercise sentence from that sign.
export interface SettlementItem {
  readonly tradeId: string;
  readonly instrument: OptionInstrument;
  readonly quantity: Rational;
  readonly expiration: string;
  // The close of the expiration session, or of the latest session before it when the date is not a session.
  // Unavailable (SessionPolicyNotCovered) when the date lies outside calendar coverage (D7 Q1): no Record expiration then.
  readonly settlementTime: SettlementTime;
}

export type SettlementTime = CalculationResult<Instant, Extract<UnavailableReason, { reason: 'SessionPolicyNotCovered' }>, never>;

// The close of the session an expiration date names, or of the latest session before it when it is not one (A111).
// A date outside calendar coverage has no such close (D7 Q1).
export async function settlementTimeOf(marketData: MarketData, instrument: OptionInstrument, expiration: string): Promise<SettlementTime> {
  const session = await marketData.query({ kind: 'ResolveSession', context: { kind: 'Historical', tradingDate: expiration } });
  if (session.kind === 'Session') return { kind: 'Value', value: session.closeInstant };
  const issue = session.kind === 'Rejected' ? session.issues[0] : undefined;
  if (issue?.latestSession) return { kind: 'Value', value: issue.latestSession.closeInstant };
  if (issue?.code === 'SessionPolicyCoverage') return { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument, date: expiration };
  throw new Error(`no settlement time for ${expiration}`);
}

// The Planned and Current Expiration Payoff of the Trade from its Plan and the Lots it still holds (AC-CALC-004).
export function payoffOf(analysis: TradeAnalysisRecord, state: DerivedTradeState): ExpirationPayoffs {
  const lots = state.positions.flatMap((p) =>
    p.instrument.kind === 'Option' ? p.openLots.map((l) => ({ instrument: p.instrument as OptionInstrument, quantity: l.quantity, basis: l.price, unconsumedOpeningFee: l.unconsumedOpeningFee })) : [],
  );
  return expirationPayoff({ plan: analysis.plan, exposure: { lots, realizedToDate: state.realizedToDate } });
}
