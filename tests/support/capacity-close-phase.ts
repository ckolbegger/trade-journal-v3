import type { EngineMeasurement } from '../../tools/capacity/profile.ts';

// The Close phase fields of an EngineMeasurement (D6 T6.22) for capacity-projection tests of earlier
// schemas, which price nothing from the Close phase: every count and byte figure is zero.
export const NO_CLOSE_PHASE: Pick<
  EngineMeasurement,
  | 'closedTrades'
  | 'exitPositionChanges'
  | 'exitExecutions'
  | 'closeReviewsCompletedAtCapture'
  | 'closeReviewsDeclinedAtCapture'
  | 'closeReviewDebtsAnswered'
  | 'closeReviewDebtsDeclined'
  | 'closeReviewDebtsOutstanding'
  | 'closeOverheadRatio'
  | 'jsonBytesPerExitPositionChange'
  | 'jsonBytesPerExitExecution'
  | 'jsonBytesPerCloseReviewCompletedAtCapture'
  | 'jsonBytesPerCloseReviewDeclinedAtCapture'
  | 'jsonBytesPerCloseReviewDebtAnswered'
  | 'jsonBytesPerCloseReviewDebtDeclined'
  | 'jsonBytesPerCloseReviewDebtOutstanding'
  | 'bytesPerExitPositionChange'
  | 'bytesPerExitExecution'
  | 'bytesPerCloseReviewCompletedAtCapture'
  | 'bytesPerCloseReviewDeclinedAtCapture'
  | 'bytesPerCloseReviewDebtAnswered'
  | 'bytesPerCloseReviewDebtDeclined'
  | 'bytesPerCloseReviewDebtOutstanding'
> = {
  closedTrades: 0,
  exitPositionChanges: 0,
  exitExecutions: 0,
  closeReviewsCompletedAtCapture: 0,
  closeReviewsDeclinedAtCapture: 0,
  closeReviewDebtsAnswered: 0,
  closeReviewDebtsDeclined: 0,
  closeReviewDebtsOutstanding: 0,
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
};
