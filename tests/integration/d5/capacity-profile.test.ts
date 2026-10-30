import { describe, expect, it } from 'vitest';
import { MEASURED, project, type EngineMeasurement } from '../../../tools/capacity/profile.ts';

// T5.19: the capacity projection for schema 4 prices the deferred part of the Position Change
// Reflection outcomes from measured Debt bytes, using the D5 section 1.4 split.

const MEASUREMENT: EngineMeasurement = {
  engine: 'test',
  version: '0',
  plans: 1,
  bytesPerTradeWithReflection: 0,
  jsonBytesPerTradeWithReflection: 0,
  overheadRatio: 0,
  jsonBytesPerCatalogRecord: 0,
  openTrades: 1,
  positionChanges: 1,
  executions: 1,
  reflectionEntries: 1,
  reflectionDeclines: 0,
  usageAfterOpen: 0,
  positionChangeOverheadRatio: 1,
  jsonBytesPerPositionChange: 0,
  jsonBytesPerExecution: 0,
  jsonBytesPerPositionChangeReflection: 0,
  bytesPerPositionChange: 0,
  bytesPerExecution: 0,
  bytesPerPositionChangeReflection: 10,
  marks: 0,
  correctedMarks: 0,
  acknowledgments: 0,
  actions: 0,
  reviewOverheadRatio: 1,
  jsonBytesPerMark: 0,
  jsonBytesPerAcknowledgment: 0,
  jsonBytesPerAction: 0,
  bytesPerMark: 0,
  bytesPerAcknowledgment: 0,
  bytesPerAction: 0,
  debtsDeferred: 2_000,
  debtsAnswered: 1_800,
  debtsDeclined: 160,
  debtsOutstanding: 40,
  debtOverheadRatio: 1,
  jsonBytesPerDebtAnswered: 0,
  jsonBytesPerDebtDeclined: 0,
  jsonBytesPerDebtOutstanding: 0,
  bytesPerDebtAnswered: 100,
  bytesPerDebtDeclined: 200,
  bytesPerDebtOutstanding: 400,
};

describe('capacity projection at schema 4', () => {
  it('should split the 100,000 Position Change Reflection outcomes 80,000 at capture, 18,000 answered, 1,600 declined and 400 Outstanding', () => {
    expect(MEASURED.positionChangeReflectionsAtCapture).toBe(80_000);
    expect(MEASURED.debtsAnswered).toBe(18_000);
    expect(MEASURED.debtsDeclined).toBe(1_600);
    expect(MEASURED.debtsOutstanding).toBe(400);
    expect(MEASURED.positionChangeReflectionsAtCapture + MEASURED.debtsAnswered + MEASURED.debtsDeclined + MEASURED.debtsOutstanding).toBe(100_000);
  });

  it('should project the deferred outcomes from the measured Debt bytes at the section 1.4 counts', () => {
    // Allowances only (81,740,000 JSON bytes × overhead 0 here is nothing), so the measured kinds alone:
    // 80,000 × 10 + 18,000 × 100 + 1,600 × 200 + 400 × 400.
    expect(project(MEASUREMENT).projectedWorkspaceBytes).toBe(800_000 + 1_800_000 + 320_000 + 160_000);
  });
});
