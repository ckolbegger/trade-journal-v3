import { describe, expect, it } from 'vitest';
import { ALLOWANCES, MEASURED, project, type EngineMeasurement } from '../../../tools/capacity/profile.ts';
import { NO_OPTION_PHASE } from '../../support/capacity-option-phase.ts';

// T6.22: the capacity projection for schema 5 prices the exits and the Close Review outcomes from
// measured bytes, using the D6 section 1.4 split, and keeps no Close Review allowance.

// Every figure zero except the Close phase's bytes, so each kind's share can be checked by hand.
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
  jsonBytesPerReflectionCompletedAtCapture: 0,
  jsonBytesPerReflectionDeclinedAtCapture: 0,
  bytesPerPositionChange: 0,
  bytesPerExecution: 0,
  bytesPerReflectionCompletedAtCapture: 0,
  bytesPerReflectionDeclinedAtCapture: 0,
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
  closedTrades: 2_000,
  exitPositionChanges: 4_000,
  exitExecutions: 8_000,
  closeReviewsCompletedAtCapture: 1_300,
  closeReviewsDeclinedAtCapture: 300,
  closeReviewDebtsAnswered: 360,
  closeReviewDebtsDeclined: 32,
  closeReviewDebtsOutstanding: 8,
  closeOverheadRatio: 1,
  jsonBytesPerExitPositionChange: 0,
  jsonBytesPerExitExecution: 0,
  jsonBytesPerCloseReviewCompletedAtCapture: 0,
  jsonBytesPerCloseReviewDeclinedAtCapture: 0,
  jsonBytesPerCloseReviewDebtAnswered: 0,
  jsonBytesPerCloseReviewDebtDeclined: 0,
  jsonBytesPerCloseReviewDebtOutstanding: 0,
  bytesPerExitPositionChange: 10,
  bytesPerExitExecution: 20,
  bytesPerCloseReviewCompletedAtCapture: 1,
  bytesPerCloseReviewDeclinedAtCapture: 2,
  bytesPerCloseReviewDebtAnswered: 3,
  bytesPerCloseReviewDebtDeclined: 4,
  bytesPerCloseReviewDebtOutstanding: 5,
  ...NO_OPTION_PHASE,
};

describe('capacity projection at schema 5', () => {
  it('should split the mature profile into half entries and half exits for Position Changes and Executions', () => {
    expect(MEASURED.positionChangeEntries + MEASURED.positionChangeExits).toBe(100_000);
    // Since D7 the exit side holds the 3,000 Expirations, which are settlement facts, not Executions.
    expect(MEASURED.executionEntries + MEASURED.executionExits + MEASURED.expirations).toBe(200_000);
    expect(MEASURED.positionChangeExits).toBe(MEASURED.positionChangeEntries);
    expect(MEASURED.executionExits + MEASURED.expirations).toBe(MEASURED.executionEntries);
  });

  it('should split the 24,700 Close Review outcomes with the fractions of the Position Change Reflections, 65%, 15%, 18%, 1.6% and 0.4%', () => {
    expect(MEASURED.closeReviewsCompletedAtCapture).toBe(16_055);
    expect(MEASURED.closeReviewsDeclinedAtCapture).toBe(3_705);
    expect(MEASURED.closeReviewDebtsAnswered).toBe(4_446);
    expect(MEASURED.closeReviewDebtsDeclined).toBe(395);
    expect(MEASURED.closeReviewDebtsOutstanding).toBe(99);
    const total =
      MEASURED.closeReviewsCompletedAtCapture +
      MEASURED.closeReviewsDeclinedAtCapture +
      MEASURED.closeReviewDebtsAnswered +
      MEASURED.closeReviewDebtsDeclined +
      MEASURED.closeReviewDebtsOutstanding;
    expect(total).toBe(24_700);
  });

  it('should project the exits and the Close Review outcomes from the measured bytes at their mature counts', () => {
    // Allowances (Review Notes, Daily Bars, Correction versions) × overhead 0 here are nothing:
    // 50,000 × 10 + 97,000 × 20 (the other 3,000 exits are Expirations, zero here) + 16,055 × 1 + 3,705 × 2 + 4,446 × 3 + 395 × 4 + 99 × 5.
    expect(project(MEASUREMENT).projectedWorkspaceBytes).toBe(500_000 + 1_940_000 + 16_055 + 7_410 + 13_338 + 1_580 + 495);
  });

  it('should reject an engine measurement taken before schema 5 that lacks the Close phase figures', () => {
    const older: { -readonly [K in keyof EngineMeasurement]?: EngineMeasurement[K] } = { ...MEASUREMENT };
    delete older.bytesPerExitPositionChange;
    delete older.bytesPerCloseReviewCompletedAtCapture;
    expect(() => project(older as EngineMeasurement)).toThrow(/test.*measure:capacity/);
  });

  it('should keep no allowance for Close Review outcomes', () => {
    expect(ALLOWANCES.map((a) => a.kind)).toEqual(['Review Notes and Trader Reflections', 'Daily Bars', 'Correction versions']);
  });
});
