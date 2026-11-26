import type { OptionInstrument } from '../domain/instrument/index.ts';
import { expirationPayoff, expirationStanding, type CalculationResult, type DerivedTradeState, type ExpirationPayoffs, type ExpirationStandingFigures, type TradeAnalysisRecord } from '../domain/trade-analysis/index.ts';

// The option Lots the Trade still holds, as the payoff views take them.
function openOptionLots(state: DerivedTradeState) {
  return state.positions.flatMap((p) =>
    p.instrument.kind === 'Option' ? p.openLots.map((l) => ({ instrument: p.instrument as OptionInstrument, quantity: l.quantity, basis: l.price, unconsumedOpeningFee: l.unconsumedOpeningFee })) : [],
  );
}

// The Planned and Current Expiration Payoff of the Trade from its Plan and the Lots it still holds (AC-CALC-004).
export function payoffOf(analysis: TradeAnalysisRecord, state: DerivedTradeState): ExpirationPayoffs {
  return expirationPayoff({ plan: analysis.plan, exposure: { lots: openOptionLots(state), realizedToDate: state.realizedToDate } });
}

// Where an expiring contract finished (A314), from the Underlying's Mark for the expiration session as recorded decimal text; absent when it has none.
export function standingOf(state: DerivedTradeState, contract: OptionInstrument, underlyingMark: string | undefined): CalculationResult<ExpirationStandingFigures> {
  return expirationStanding({ contract, exposure: { lots: openOptionLots(state), realizedToDate: state.realizedToDate }, oneR: state.baseline.oneR, ...(underlyingMark !== undefined && { underlyingMark }) });
}
