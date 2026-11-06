// Test support: D7's option reference Trades (breakdown, section 4). O-C is the Long Call on XYZ, O-S the
// Cash-Secured Put on MNO; every contract expires 2026-11-20. Plans are confirmed Monday 2026-10-12 09:00 New York.
import type { OptionInstrument } from '../instrument/index.ts';
import type { ExecutionFact, PositionChangeFact, TradeAnalysisRecord } from './derive.ts';
import { positionChange } from './reference-trade.ts';

export const OC_LEG_ID = 'leg-oc';
export const OS_LEG_ID = 'leg-os';

const contract = (symbol: string, strike: string, right: 'Call' | 'Put'): OptionInstrument => ({
  kind: 'Option',
  symbol,
  root: symbol,
  expiration: '2026-11-20',
  strike,
  right,
  multiplier: 100,
});
export const OC_CONTRACT = contract('XYZ', '55', 'Call');
export const OS_CONTRACT = contract('MNO', '45', 'Put');

export function optionExecution(
  legId: string,
  instrument: OptionInstrument,
  factId: string,
  economicTime: string,
  recordedSequence: number,
  action: 'Buy' | 'Sell',
  quantity: string,
  price: string,
  fee: string,
): ExecutionFact {
  return { factId, economicTime, recordedSequence, action, instrument, quantity, price, fee, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId } };
}

// A single-Execution Position Change on O-C or O-S.
export const ocChange = (factId: string, time: string, seq: number, action: 'Buy' | 'Sell', quantity: string, price: string, fee: string): PositionChangeFact =>
  positionChange(factId, seq, [optionExecution(OC_LEG_ID, OC_CONTRACT, `ex-${factId}`, time, seq + 1, action, quantity, price, fee)]);
export const osChange = (factId: string, time: string, seq: number, action: 'Buy' | 'Sell', quantity: string, price: string, fee: string): PositionChangeFact =>
  positionChange(factId, seq, [optionExecution(OS_LEG_ID, OS_CONTRACT, `ex-${factId}`, time, seq + 1, action, quantity, price, fee)]);

// O-C: PC1 Monday 10:00 Buy 1 @ 2.10, PC2 Monday 11:00 Buy 1 @ 1.90, X1 Tuesday 10:00 Sell 1 @ 3.00, each fee 0.65.
export const OC_PC1 = ocChange('pc-1', '2026-10-12T14:00:00Z', 1, 'Buy', '1', '2.10', '0.65');
export const OC_PC2 = ocChange('pc-2', '2026-10-12T15:00:00Z', 3, 'Buy', '1', '1.90', '0.65');
export const OC_X1 = ocChange('pc-x1', '2026-10-13T14:00:00Z', 5, 'Sell', '1', '3.00', '0.65');
// O-S: S1 Monday 10:00 Sell 2 @ 1.25 fee 1.30, B1 Tuesday 10:00 Buy 1 @ 0.60 fee 0.65.
export const OS_S1 = osChange('pc-s1', '2026-10-12T14:00:00Z', 1, 'Sell', '2', '1.25', '1.30');
export const OS_B1 = osChange('pc-b1', '2026-10-13T14:00:00Z', 3, 'Buy', '1', '0.60', '0.65');

function record(plan: TradeAnalysisRecord['plan'], positionChanges: readonly PositionChangeFact[]): TradeAnalysisRecord {
  return { tradeId: 'trade-o', factRevision: 3, storedLifecycle: positionChanges.length > 0 ? 'Open' : 'Planned', plan, positionChanges };
}

// Plan: 2 contracts at 2.00, Stop XYZ at or below 48.00 (value 0), Target XYZ at or above 60.00 (value 5.00).
export const ocRecord = (positionChanges: readonly PositionChangeFact[] = []): TradeAnalysisRecord =>
  record(
    {
      economicTime: '2026-10-12T13:00:00Z',
      underlying: 'XYZ',
      thesis: 'Breakout.',
      invalidation: 'Below 48.',
      legs: [{ factId: OC_LEG_ID, side: 'Long', instrument: OC_CONTRACT, quantity: '2', intendedEntry: '2.00' }],
      stops: [{ factId: 'stop-1', kind: 'UnderlyingPrice', price: '48.00' }],
      targets: [{ factId: 'target-1', kind: 'UnderlyingPrice', price: '60.00' }],
    },
    positionChanges,
  );

// Plan: -2 contracts at 1.20 credit, Stop MNO at or below 42.00 (value 3.00), Target MNO at or above 50.00 (value 0).
export const osRecord = (positionChanges: readonly PositionChangeFact[] = []): TradeAnalysisRecord =>
  record(
    {
      economicTime: '2026-10-12T13:00:00Z',
      underlying: 'MNO',
      thesis: 'Support holds.',
      invalidation: 'Below 42.',
      legs: [{ factId: OS_LEG_ID, side: 'Short', instrument: OS_CONTRACT, quantity: '-2', intendedEntry: '1.20' }],
      stops: [{ factId: 'stop-s', kind: 'UnderlyingPrice', price: '42.00' }],
      targets: [{ factId: 'target-s', kind: 'UnderlyingPrice', price: '50.00' }],
    },
    positionChanges,
  );
