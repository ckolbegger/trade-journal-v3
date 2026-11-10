import type { OptionInstrument } from '../domain/instrument/index.ts';
import { expirationPayoff, type DerivedTradeState, type ExpirationPayoffs, type TradeAnalysisRecord } from '../domain/trade-analysis/index.ts';

// The Planned and Current Expiration Payoff of the Trade from its Plan and the Lots it still holds (AC-CALC-004).
export function payoffOf(analysis: TradeAnalysisRecord, state: DerivedTradeState): ExpirationPayoffs {
  const lots = state.positions.flatMap((p) =>
    p.instrument.kind === 'Option' ? p.openLots.map((l) => ({ instrument: p.instrument as OptionInstrument, quantity: l.quantity, basis: l.price, unconsumedOpeningFee: l.unconsumedOpeningFee })) : [],
  );
  return expirationPayoff({ plan: analysis.plan, exposure: { lots, realizedToDate: state.realizedToDate } });
}
