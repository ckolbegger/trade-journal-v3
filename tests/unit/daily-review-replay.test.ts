import { describe, expect, it } from 'vitest';
import { fromInteger } from '../../src/shared/exact-number';
import { makeMark, makeReviewActionEntry } from '../helpers/builders';
import { snapshotAllStores } from '../helpers/store-snapshot';
import { createTestJournalHarness } from '../helpers/workspace-harness';

async function setupClosedClsdScenario() {
  const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
  const { tradeId, factRevision } = await h.openLongStock({
    symbol: 'CLSD',
    entry: '50.00',
    stop: '47.00',
    target: '56.00',
    economicTime: '2026-11-02T15:00:00.000Z',
  });

  h.clock.setIso('2026-11-03T22:00:00.000Z');
  await h.marketData.save({
    kind: 'SaveManualMark',
    symbol: 'CLSD',
    sessionDate: '2026-11-02',
    price: '52.00',
    intent: 'Initial',
  });
  await h.closeLongStock({
    tradeId,
    expectedFactRevision: factRevision,
    economicTime: '2026-11-03T19:00:00.000Z',
    fillPrice: '56.00',
    closeReasonId: h.closeReasonIds.targetReached,
    deferReflection: true,
  });

  const initialOpen = await h.dailyReview.open('2026-11-03');
  for (const debt of initialOpen.dueDebt) {
    await h.dailyReview.save({
      kind: 'ResolveReviewDebt',
      debtId: debt.debt.id,
      reviewDate: '2026-11-03',
      mode: 'Decline',
      expectedSnapshot: initialOpen.expectedSnapshot,
    });
  }

  return { h, tradeId };
}

async function setupPastStopOpenAxio() {
  const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
  const { tradeId } = await h.openLongStock({
    symbol: 'AXIO',
    entry: '50.00',
    stop: '47.00',
    target: '56.00',
    economicTime: '2026-11-02T15:00:00.000Z',
  });

  h.clock.setIso('2026-11-03T22:00:00.000Z');
  await h.persistence.runWriteTransaction(['market_marks', 'journal_entries'], async (tx) => {
    tx.put('market_marks', makeMark({ symbol: 'AXIO', sessionDate: '2026-11-02', price: '46.50' }));
    tx.put('market_marks', makeMark({ symbol: 'AXIO', sessionDate: '2026-11-03', price: '46.00' }));
    tx.put(
      'journal_entries',
      makeReviewActionEntry({ tradeId, reviewDate: '2026-11-02', action: 'Hold', reason: 'Keep holding' }),
    );
  });

  return h.dailyReview.open('2026-11-03');
}

describe('DailyReview D7 Replay Previews & Closed Trade Cards seam', () => {
  it('populates Replay sessions matching entry..reviewDate on Open DailyReviewTradeItem', async () => {
    const view = await setupPastStopOpenAxio();
    expect(view.trades).toHaveLength(1);
    expect(view.trades[0]!.replay.sessions.map((s) => s.sessionDate)).toEqual([
      '2026-11-02',
      '2026-11-03',
    ]);
  });

  it('sets highlightPrimary and Past-Stop streak summaryLine on PastStop Open DailyReviewTradeItem', async () => {
    const view = await setupPastStopOpenAxio();
    expect(view.trades[0]!.replay.highlightPrimary).toBe(true);
    expect(view.trades[0]!.replay.summaryLine).toContain('Past the Stop since Mon, Nov 2 · 2 sessions');
  });

  it('keeps completionState Complete when closedTrades exist without D8 Close Review obligations', async () => {
    const { h } = await setupClosedClsdScenario();
    const nov3 = await h.dailyReview.open('2026-11-03');
    expect(nov3.completionState).toBe('Complete');
    expect(nov3.closedTrades).toHaveLength(1);
    expect(nov3.dueDebt).toHaveLength(0);
  });

  it('populates Closed Trade card closeReasonLabel and exact Rational realizedPnl', async () => {
    const { h } = await setupClosedClsdScenario();
    const nov3 = await h.dailyReview.open('2026-11-03');
    expect(nov3.closedTrades).toHaveLength(1);
    const item = nov3.closedTrades[0]!;
    expect(item.symbol).toBe('CLSD');
    expect(item.closeReasonLabel).toBe('Target Reached');
    expect(item.realizedPnl).toEqual(fromInteger(600));
    expect(item.realizedPnlDisplay).toBe('+$600.00');
    expect(item.integrityBlockedReason).toBeNull();
  });

  it('bounds Closed Trade replay model strictly to completed sessions through close date', async () => {
    const { h } = await setupClosedClsdScenario();
    const nov3 = await h.dailyReview.open('2026-11-03');
    const item = nov3.closedTrades[0]!;
    expect(item.replay?.isClosed).toBe(true);
    expect(item.replay?.sessions.map((s) => s.sessionDate)).toEqual([
      '2026-11-02',
      '2026-11-03',
    ]);
  });

  it('sorts closedTrades newest-closed-first across multiple closed trades', async () => {
    const { h } = await setupClosedClsdScenario();
    const second = await h.openLongStock({
      symbol: 'ZETA',
      entry: '40.00',
      stop: '38.00',
      target: '44.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });
    h.clock.setIso('2026-11-04T22:00:00.000Z');
    await h.closeLongStock({
      tradeId: second.tradeId,
      expectedFactRevision: second.factRevision,
      economicTime: '2026-11-04T19:00:00.000Z',
      fillPrice: '44.00',
      closeReasonId: h.closeReasonIds.targetReached,
    });

    const nov4 = await h.dailyReview.open('2026-11-04');
    expect(nov4.closedTrades.map((c) => c.symbol)).toEqual(['ZETA', 'CLSD']);
  });

  it('hides trades closed after reviewDate from closedTrades while showing them as Open at that cutoff', async () => {
    const { h } = await setupClosedClsdScenario();
    const nov2 = await h.dailyReview.open('2026-11-02');
    expect(nov2.closedTrades).toHaveLength(0);
    expect(nov2.trades.map((t) => t.symbol)).toEqual(['CLSD']);
  });

  it('sets closeReasonLabel to null in closedTrades when closeReasonId is absent', async () => {
    const { h, tradeId } = await setupClosedClsdScenario();
    await h.persistence.runWriteTransaction(['trades'], async (tx) => {
      const row = await tx.get('trades', tradeId);
      expect(row).toBeDefined();
      const next = { ...row! };
      delete (next as { closeReasonId?: string }).closeReasonId;
      tx.put('trades', next);
    });

    const nov3 = await h.dailyReview.open('2026-11-03');
    expect(nov3.closedTrades).toHaveLength(1);
    expect(nov3.closedTrades[0]!.closeReasonLabel).toBeNull();
  });

  it('surfaces Closed Trades with integrityDisagreement in closedTrades and excludes them from open trades', async () => {
    const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
    const { tradeId } = await h.openLongStock({
      symbol: 'BADC',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });

    await h.persistence.runWriteTransaction(['trades'], async (tx) => {
      const row = await tx.get('trades', tradeId);
      expect(row).toBeDefined();
      tx.put('trades', {
        ...row!,
        lifecycleState: 'Closed',
        closedAt: '2026-11-02T19:00:00.000Z',
      });
    });

    const nov2 = await h.dailyReview.open('2026-11-02');
    expect(nov2.trades.map((t) => t.symbol)).not.toContain('BADC');
    expect(nov2.closedTrades).toHaveLength(1);
    expect(nov2.closedTrades[0]!.symbol).toBe('BADC');
    expect(nov2.closedTrades[0]!.replay).toBeNull();
    expect(nov2.closedTrades[0]!.integrityBlockedReason).toBe(
      'Stored lifecycle (Closed) disagrees with derived position (Open).',
    );
  });

  it('surfaces Closed Trades that have zero recorded executions explicitly in closedTrades when closedAt is present', async () => {
    const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
    const tradeId = await h.createPlannedLongStock({
      symbol: 'NOEX',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });

    await h.persistence.runWriteTransaction(['trades'], async (tx) => {
      const row = await tx.get('trades', tradeId);
      expect(row).toBeDefined();
      tx.put('trades', {
        ...row!,
        lifecycleState: 'Closed',
        closedAt: '2026-11-02T19:00:00.000Z',
      });
    });

    const nov2 = await h.dailyReview.open('2026-11-02');
    expect(nov2.closedTrades).toHaveLength(1);
    expect(nov2.closedTrades[0]!.symbol).toBe('NOEX');
    expect(nov2.closedTrades[0]!.replay).toBeNull();
    expect(nov2.closedTrades[0]!.integrityBlockedReason).toBe(
      'Stored lifecycle (Closed) has no recorded executions.',
    );
  });

  it('keeps dailyReview.open strictly read-only across all 21 workspace stores (snapshotAllStores)', async () => {
    const { h } = await setupClosedClsdScenario();
    const before = await snapshotAllStores(h.persistence);
    const view = await h.dailyReview.open('2026-11-03');
    expect(view.closedTrades).toHaveLength(1);
    const after = await snapshotAllStores(h.persistence);
    expect(after).toEqual(before);
  });

  it('surfaces Closed Trades with zero executions and missing closedAt explicitly in closedTrades', async () => {
    const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
    const tradeId = await h.createPlannedLongStock({
      symbol: 'NOCD',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });
    await h.persistence.runWriteTransaction(['trades'], async (tx) => {
      const row = await tx.get('trades', tradeId);
      expect(row).toBeDefined();
      const next = { ...row!, lifecycleState: 'Closed' as const };
      delete (next as { closedAt?: string }).closedAt;
      tx.put('trades', next);
    });

    const nov2 = await h.dailyReview.open('2026-11-02');
    expect(nov2.trades.map((t) => t.symbol)).not.toContain('NOCD');
    expect(nov2.closedTrades).toHaveLength(1);
    expect(nov2.closedTrades[0]!.symbol).toBe('NOCD');
    expect(nov2.closedTrades[0]!.integrityBlockedReason).toBe(
      'Stored lifecycle (Closed) has no recorded executions.',
    );
  });

  it('surfaces Closed Trades whose final Sell occurred by reviewDate even when closedAt timestamp is later', async () => {
    const { h, tradeId } = await setupClosedClsdScenario();
    await h.persistence.runWriteTransaction(['trades'], async (tx) => {
      const row = await tx.get('trades', tradeId);
      expect(row).toBeDefined();
      tx.put('trades', { ...row!, closedAt: '2026-11-04T15:00:00.000Z' });
    });

    h.clock.setIso('2026-11-04T22:00:00.000Z');
    const nov3 = await h.dailyReview.open('2026-11-03');
    expect(nov3.closedTrades).toHaveLength(1);
    expect(nov3.closedTrades[0]!.symbol).toBe('CLSD');
    expect(nov3.closedTrades[0]!.replay?.isClosed).toBe(true);
  });

  it('lists Trades entered and closed after reviewDate in openedAfterCutoffTrades', async () => {
    const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
    const opened = await h.openLongStock({
      symbol: 'POST',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-04T15:00:00.000Z',
    });
    h.clock.setIso('2026-11-05T22:00:00.000Z');
    await h.closeLongStock({
      tradeId: opened.tradeId,
      expectedFactRevision: opened.factRevision,
      economicTime: '2026-11-05T19:00:00.000Z',
      fillPrice: '54.00',
      closeReasonId: h.closeReasonIds.targetReached,
    });

    const nov2 = await h.dailyReview.open('2026-11-02');
    expect(nov2.openedAfterCutoffTrades.map((t) => t.symbol)).toEqual(['POST']);
  });
});
