// Results of recordPositionChange for T-A's exits (D6 breakdown, section 4), with the engine's own
// derivation, so the exit receipt's figures are the ones the workflow would return.
import { derive, type TradeAnalysisRecord } from '../../src/domain/trade-analysis/index.ts';
import { PC1, PC2, positionChange, referenceRecord, sellExecution, X1, X2 } from '../../src/domain/trade-analysis/reference-trade.ts';
import { Rational } from '../../src/domain/values/index.ts';

function derived(record: TradeAnalysisRecord) {
  const derivation = derive({ record });
  if (derivation.kind !== 'Derived') throw new Error('incoherent fixture');
  return derivation;
}

// The final exit: PC1 and PC2 bought 100 shares, X1 sold 30 on Tuesday 10:00, and X2 sold the other
// 70 at 14:00 (two rows) with Close Reason `cr-1`.
export function closedExitResult(overrides: { readonly closeReview?: unknown; readonly reflection?: unknown } = {}) {
  const record: TradeAnalysisRecord = {
    ...referenceRecord([PC1, PC2, X1, X2], 'Closed'),
    closeReason: { factId: 'close-reason-1', recordedSequence: 12, closeReasonId: 'cr-1', terminalPositionChangeId: 'pc-x2' },
    terminalTime: '2026-10-13T18:00:00Z',
  };
  return {
    kind: 'Recorded',
    receipt: {
      tradeId: 'trade-1',
      factRevision: 3,
      binding: { databaseName: 'tj-ws-1', contentRevision: 12 },
      createdFactIds: ['pc-x2', 'ex-x2a', 'ex-x2b'],
      lifecycleTransitions: [{ tradeId: 'trade-1', from: 'Open', to: 'Closed' }],
      reflection: { kind: 'Entry', id: 'entry-1' },
      closeReview: { kind: 'Decline', id: 'decline-1' },
      deviationReconciliation: [],
      entryChanges: [],
      repairs: [],
      lotMatchChanges: [],
      realizedToDate: { before: Rational.of(559n, 10n), after: Rational.of(248n) },
    },
    postCommit: {
      trade: record,
      derivation: derived(record),
      reflection: overrides.reflection ?? { kind: 'Entry', entry: { id: 'entry-1' } },
      closeReview: overrides.closeReview ?? { kind: 'Decline', decline: { id: 'decline-1', reason: 'Nothing to add.' } },
    },
    affected: [],
  };
}

// The partial exit: X1 alone sells 30 of the 100 shares, the Trade stays Open, and the exit's
// reflection is deferred.
export function partialExitResult() {
  const record = referenceRecord([PC1, PC2, X1], 'Open');
  const closed = closedExitResult();
  return {
    ...closed,
    receipt: {
      ...closed.receipt,
      createdFactIds: ['pc-x1', 'ex-x1'],
      lifecycleTransitions: [],
      // A plain exit only creates the matches of its own Sell.
      lotMatchChanges: [{ kind: 'Created', openingExecutionId: 'ex-1', disposingExecutionId: 'ex-x1', quantity: { before: null, after: Rational.of(30n) } }],
      realizedToDate: { before: Rational.of(0n), after: derived(record).realizedToDate },
    },
    postCommit: { trade: record, derivation: derived(record), reflection: { kind: 'Debt', debt: { debtId: 'debt-1' } } },
  };
}

// I6.8's 60-share example: X1 (30 shares, 10:00) is recorded, then X0 sells 60 shares dated 09:45 the
// same day. FIFO now matches X0 <- PC1 60 and X1 <- PC2 30, replacing X1 <- PC1 30. The Trade stays
// Open with 10 shares, and the figures before and after are the engine's own derivations.
export function earlierDatedExitResult() {
  const before = referenceRecord([PC1, PC2, X1], 'Open');
  const x0 = positionChange('pc-x0', 11, [sellExecution('ex-x0', '2026-10-13T13:45:00Z', 12, '60', '51.50', '0.80')]);
  const after = referenceRecord([PC1, PC2, x0, X1], 'Open');
  const partial = partialExitResult();
  return {
    ...partial,
    receipt: {
      ...partial.receipt,
      createdFactIds: ['pc-x0', 'ex-x0'],
      lotMatchChanges: [
        { kind: 'Superseded', openingExecutionId: 'ex-1', disposingExecutionId: 'ex-x1', quantity: { before: Rational.of(30n), after: null } },
        { kind: 'Created', openingExecutionId: 'ex-1', disposingExecutionId: 'ex-x0', quantity: { before: null, after: Rational.of(60n) } },
        { kind: 'Created', openingExecutionId: 'ex-2', disposingExecutionId: 'ex-x1', quantity: { before: null, after: Rational.of(30n) } },
      ],
      realizedToDate: { before: derived(before).realizedToDate, after: derived(after).realizedToDate },
    },
    postCommit: { ...partial.postCommit, trade: after, derivation: derived(after) },
  };
}
