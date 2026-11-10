import type { OptionInstrument } from '../../domain/instrument/index.ts';
import type { MarketData, MarketDataSettlementTime } from '../../modules/market-data/index.ts';
import type { Rational } from '../../domain/values/index.ts';

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

// Market Data's own shape: the read session answers it, and so does the query below.
export type SettlementTime = MarketDataSettlementTime;

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
