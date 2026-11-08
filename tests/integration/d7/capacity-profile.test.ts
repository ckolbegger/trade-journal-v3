import { describe, expect, it } from 'vitest';
import { MEASURED, project, type EngineMeasurement } from '../../../tools/capacity/profile.ts';
import { NO_OPTION_PHASE } from '../../support/capacity-option-phase.ts';

// T7.26-B1: the projection prices the 7,500 option Trades and the 3,000 Expirations at nonzero measured
// bytes (the earlier schemas' tests zero both through NO_OPTION_PHASE).

// Every figure zero except the two Option phase prices, so each term's share can be checked by hand.
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
  bytesPerExitPositionChange: 0,
  bytesPerExitExecution: 0,
  bytesPerCloseReviewCompletedAtCapture: 0,
  bytesPerCloseReviewDeclinedAtCapture: 0,
  bytesPerCloseReviewDebtAnswered: 0,
  bytesPerCloseReviewDebtDeclined: 0,
  bytesPerCloseReviewDebtOutstanding: 0,
  ...NO_OPTION_PHASE,
  bytesPerOptionTradeWithReflection: 100,
  bytesPerExpiration: 30,
};

describe('capacity projection at schema 6', () => {
  it('should project the D7 option Trades and Expirations at their measured prices', () => {
    expect(MEASURED.optionTradesWithPlanReflection).toBe(7_500);
    expect(MEASURED.expirations).toBe(3_000);
    // 7,500 × 100 + 3,000 × 30; every other kind is priced at zero bytes here.
    expect(project(MEASUREMENT).projectedWorkspaceBytes).toBe(750_000 + 90_000);
  });
});
