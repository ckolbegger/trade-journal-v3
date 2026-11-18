// Test support: D2's reference Trade (breakdown, section 4). Long Stock Plan for 100 shares,
// intended entry 50.00, Stop 47.50, Target 56.00, confirmed 2026-10-12 09:00 America/New_York.
import type { Instrument } from '../instrument/index.ts';
import type { ExecutionFact, PositionChangeFact, TradeAnalysisRecord } from './derive.ts';

export const LEG_ID = 'leg-1';

export function execution(
  factId: string,
  economicTime: string,
  recordedSequence: number,
  quantity: string,
  price: string,
  fee: string,
): ExecutionFact {
  return {
    factId,
    economicTime,
    recordedSequence,
    action: 'Buy',
    instrument: { kind: 'Stock', symbol: 'XYZ' },
    quantity,
    price,
    fee,
    intent: { kind: 'ServesPlannedLeg', plannedLegId: LEG_ID },
  };
}

export function sellExecution(
  factId: string,
  economicTime: string,
  recordedSequence: number,
  quantity: string,
  price: string,
  fee: string,
): ExecutionFact {
  return { ...execution(factId, economicTime, recordedSequence, quantity, price, fee), action: 'Sell' };
}

export function positionChange(
  factId: string,
  recordedSequence: number,
  executions: readonly ExecutionFact[],
): PositionChangeFact {
  // A Position Change's Economic Time is its earliest member's (D2 A19).
  const economicTime = executions.map((e) => e.economicTime).sort()[0]!;
  return { factId, economicTime, recordedSequence, executions };
}

// PC1 10:00 60 @ 50.10, PC2 11:00 40 @ 50.30, PC3 14:00 20 @ 51.00, each with fee 1.00.
export const PC1 = positionChange('pc-1', 1, [execution('ex-1', '2026-10-12T14:00:00Z', 2, '60', '50.10', '1.00')]);
export const PC2 = positionChange('pc-2', 3, [execution('ex-2', '2026-10-12T15:00:00Z', 4, '40', '50.30', '1.00')]);
export const PC3 = positionChange('pc-3', 5, [execution('ex-3', '2026-10-12T18:00:00Z', 6, '20', '51.00', '1.00')]);

// T-A's exits (D6 breakdown, section 4), Tuesday 2026-10-13: X1 10:00 sells 30 @ 52.00, fee 0.60;
// X2 14:00 is one decision of X2a 50 @ 53.00, fee 1.00, and X2b 20 @ 53.00, fee 0.40.
export const X1 = positionChange('pc-x1', 7, [sellExecution('ex-x1', '2026-10-13T14:00:00Z', 8, '30', '52.00', '0.60')]);
export const X2 = positionChange('pc-x2', 9, [
  sellExecution('ex-x2a', '2026-10-13T18:00:00Z', 10, '50', '53.00', '1.00'),
  sellExecution('ex-x2b', '2026-10-13T18:00:00Z', 11, '20', '53.00', '0.40'),
]);

// D9's replay test Trades (breakdown, section 5). A series is a record holding every Execution of the series, and the
// observed Marks of its sessions: `underlying[i]` and `held[i]` (null: no Mark) belong to `REPLAY_SESSION_DATES[i]`.
// A series with fewer Marks than sessions has no Mark on the sessions after its last.
export const REPLAY_SESSION_DATES = [
  '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11',
  '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20',
] as const;
export interface ReplayTestSeries {
  readonly id: string;
  readonly record: TradeAnalysisRecord;
  readonly underlying: readonly (string | null)[];
  readonly held: readonly (string | null)[];
}

// R-AXIO: long AXIO stock, 200 shares at $50.00, Stop at or below $47.00, Target at or above $56.00 (1R $600, reward $1,200).
// Every Execution is at 10:00 New York (EST), fee 0.00.
export const AXIO: Instrument = { kind: 'Stock', symbol: 'AXIO' };
export const AXIO_LEG_ID = 'leg-axio';
const axioExecution = (factId: string, economicTime: string, recordedSequence: number, action: 'Buy' | 'Sell', quantity: string, price: string): ExecutionFact => ({
  ...execution(factId, economicTime, recordedSequence, quantity, price, '0.00'),
  action,
  instrument: AXIO,
  intent: { kind: 'ServesPlannedLeg', plannedLegId: AXIO_LEG_ID },
});
const axioRecord = (positionChanges: readonly PositionChangeFact[]): TradeAnalysisRecord => ({
  tradeId: 'trade-axio',
  factRevision: 3,
  storedLifecycle: 'Open',
  plan: {
    economicTime: '2026-10-30T13:00:00Z',
    underlying: 'AXIO',
    thesis: 'Breakout.',
    invalidation: 'Below 47.',
    legs: [{ factId: AXIO_LEG_ID, side: 'Long', instrument: AXIO, quantity: '200', intendedEntry: '50' }],
    stops: [{ factId: 'stop-1', kind: 'UnderlyingPrice', price: '47.00' }],
    targets: [{ factId: 'target-1', kind: 'UnderlyingPrice', price: '56.00' }],
  },
  positionChanges,
});

// Buys 100 at $50.00 Mon 11-02 and 100 at $51.40 Fri 11-06; climbs through the Target on Tue 11-17.
const AXIO_U_UNDERLYING = ['50.40', '50.90', '50.70', '51.30', '51.80', '52.60', '52.30', '53.40', '54.10', '53.80', '55.20', '56.30', '57.10', '56.70', '57.40'];
export const R_AXIO_U: ReplayTestSeries = {
  id: 'R-AXIO-U',
  record: axioRecord([
    positionChange('pc-axio-1', 1, [axioExecution('ex-axio-1', '2026-11-02T15:00:00Z', 2, 'Buy', '100', '50.00')]),
    positionChange('pc-axio-2', 3, [axioExecution('ex-axio-2', '2026-11-06T15:00:00Z', 4, 'Buy', '100', '51.40')]),
  ]),
  underlying: AXIO_U_UNDERLYING,
  held: AXIO_U_UNDERLYING,
};

// Buys 200 at $50.00 Mon 11-02; gaps below the Stop, and 100 are sold at $45.60 Mon 11-09.
const AXIO_D_UNDERLYING = ['49.70', '49.90', '49.20', '48.60', '48.10', '45.20', '45.80', '44.90', '44.30', '45.10', '44.00', '43.20', '43.60', '42.80', '42.10'];
export const R_AXIO_D: ReplayTestSeries = {
  id: 'R-AXIO-D',
  record: axioRecord([
    positionChange('pc-axio-1', 1, [axioExecution('ex-axio-1', '2026-11-02T15:00:00Z', 2, 'Buy', '200', '50.00')]),
    positionChange('pc-axio-2', 3, [axioExecution('ex-axio-2', '2026-11-09T15:00:00Z', 4, 'Sell', '100', '45.60')]),
  ]),
  underlying: AXIO_D_UNDERLYING,
  held: AXIO_D_UNDERLYING,
};

export function referenceRecord(
  positionChanges: readonly PositionChangeFact[] = [],
  storedLifecycle: TradeAnalysisRecord['storedLifecycle'] = positionChanges.length > 0 ? 'Open' : 'Planned',
): TradeAnalysisRecord {
  return {
    tradeId: 'trade-1',
    factRevision: 3,
    storedLifecycle,
    plan: {
      economicTime: '2026-10-12T13:00:00Z',
      underlying: 'XYZ',
      thesis: 'Breakout.',
      invalidation: 'Below 48.',
      legs: [{ factId: LEG_ID, side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' }],
      stops: [{ factId: 'stop-1', kind: 'UnderlyingPrice', price: '47.5' }],
      targets: [{ factId: 'target-1', kind: 'UnderlyingPrice', price: '56' }],
    },
    positionChanges,
  };
}
