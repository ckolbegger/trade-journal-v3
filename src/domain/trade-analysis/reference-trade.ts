// Test support: D2's reference Trade (breakdown, section 4). Long Stock Plan for 100 shares,
// intended entry 50.00, Stop 47.50, Target 56.00, confirmed 2026-10-12 09:00 America/New_York.
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
