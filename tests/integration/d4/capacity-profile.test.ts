import { describe, expect, it } from 'vitest';
import { ALLOWANCES, project, type EngineMeasurement } from '../../../tools/capacity/profile.ts';

// T4.28: the capacity projection for schema 3 uses measured bytes for Marks and Daily Trade Review
// Actions at their mature counts (190,000 and 126,000), and allowances only for what is still unbuilt.

// Round numbers so each kind's share of the projection can be checked by hand.
const MEASUREMENT: EngineMeasurement = {
  engine: 'test',
  version: '0',
  plans: 1,
  bytesPerTradeWithReflection: 1_000,
  jsonBytesPerTradeWithReflection: 500,
  overheadRatio: 2,
  jsonBytesPerCatalogRecord: 100,
  openTrades: 1,
  positionChanges: 1,
  executions: 1,
  reflectionEntries: 1,
  reflectionDeclines: 0,
  usageAfterOpen: 0,
  positionChangeOverheadRatio: 1,
  jsonBytesPerPositionChange: 10,
  jsonBytesPerExecution: 20,
  jsonBytesPerReflectionCompletedAtCapture: 30,
  jsonBytesPerReflectionDeclinedAtCapture: 30,
  bytesPerPositionChange: 10,
  bytesPerExecution: 20,
  bytesPerReflectionCompletedAtCapture: 30,
  bytesPerReflectionDeclinedAtCapture: 30,
  marks: 2_000,
  correctedMarks: 20,
  acknowledgments: 100,
  actions: 2_000,
  reviewOverheadRatio: 1.25,
  jsonBytesPerMark: 4,
  jsonBytesPerAcknowledgment: 6,
  jsonBytesPerAction: 2,
  bytesPerMark: 5,
  bytesPerAcknowledgment: 7,
  bytesPerAction: 3,
  debtsDeferred: 0,
  debtsAnswered: 0,
  debtsDeclined: 0,
  debtsOutstanding: 0,
  debtOverheadRatio: 1,
  jsonBytesPerDebtAnswered: 0,
  jsonBytesPerDebtDeclined: 0,
  jsonBytesPerDebtOutstanding: 0,
  bytesPerDebtAnswered: 0,
  bytesPerDebtDeclined: 0,
  bytesPerDebtOutstanding: 0,
};

describe('capacity projection at schema 3', () => {
  it('should project Marks and Daily Trade Review Actions from measured bytes at their mature counts', () => {
    // Measured kinds: 25,000,000 + 12,000 + 1,000,000 + 4,000,000 + 2,400,000 (the 80,000 outcomes at capture;
    // the 20,000 deferred ones are priced from Debt bytes since D5, zero here) + 190,000 × 5 + 126,000 × 3.
    // Allowances (Close Review outcomes, Review Notes, Daily Bars, Correction versions): 81,740,000 JSON bytes × 2.
    expect(project(MEASUREMENT).projectedWorkspaceBytes).toBe(197_220_000);
  });

  it('should keep allowances only for the kinds not yet built, Daily Bars among them until D11', () => {
    expect(ALLOWANCES.map((a) => a.kind)).toEqual(['Close Review outcomes', 'Review Notes and Trader Reflections', 'Daily Bars', 'Correction versions']);
    expect(ALLOWANCES.find((a) => a.kind === 'Daily Bars')?.until).toBe('D11');
  });
});
