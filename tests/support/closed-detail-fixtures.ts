// Closed Trade Detail fixtures for the UI tests: T-A's Trade (PC1, PC2, X1, X2), derived by Trade
// Analysis so every figure is the one the coordinator would show. A Closed Detail reads no Mark (A92).
import type { ClosedTradeDetail, NarrativeItem, PositionChangeFact } from '../../src/app/types.ts';
import { derive, evaluate } from '../../src/domain/trade-analysis/index.ts';
import { referenceRecord } from '../../src/domain/trade-analysis/reference-trade.ts';
import { closedLongStockSummary } from '../../src/domain/trade-summary.ts';
import { openDetailOf, type OpenDetailOptions } from './open-detail-fixtures.ts';

export interface ClosedDetailOptions extends Omit<OpenDetailOptions, 'storedLifecycle'> {
  readonly closeReason?: ClosedTradeDetail['closeReason'];
}

export function closedDetailOf(positionChanges: readonly PositionChangeFact[], options: ClosedDetailOptions = {}): ClosedTradeDetail {
  const { closeReason, ...rest } = options;
  const open = openDetailOf(positionChanges, { ...rest, storedLifecycle: 'Closed' });
  const derived = derive({ record: referenceRecord(positionChanges, 'Closed') });
  if (derived.kind !== 'Derived' || derived.terminalTime === null) throw new Error('incoherent fixture');
  const instrument = { kind: 'Stock', symbol: 'XYZ' } as const;
  const evaluation = evaluate({ state: derived, frame: { instrument, date: derived.terminalTime.slice(0, 10) } });
  const summary = closedLongStockSummary(derived);
  return {
    ...open,
    ...(summary && { summary }),
    // The Closed form carries the evaluation and its coverage only: no Expected Mark Date, Mark, or dated line.
    current: { coverage: [{ instrument, coverage: evaluation.coverage }], evaluation },
    terminalDisposition: derived.terminalDisposition,
    ...(closeReason && { closeReason }),
    terminalTime: derived.terminalTime,
    realizedR: derived.realizedR,
  };
}

// The Close Review as a completed Entry in the Trade's narrative.
export const closeReviewEntry: NarrativeItem = {
  kind: 'Entry',
  id: 'e-close',
  entryType: 'Close Review',
  entryTypeKey: 'entry-type.close-review',
  source: 'Trade close',
  anchor: { kind: 'Trade', tradeId: 'trade-1' },
  momentTime: '2026-10-13T18:00:00Z',
  authoredTime: '2026-10-13T18:05:00Z',
  responses: [{ prompt: 'What did you learn from this Trade?', answer: { kind: 'Text', text: 'Holding to the target paid.' } }],
};
