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
