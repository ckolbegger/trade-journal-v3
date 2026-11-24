import { describe, expect, it } from 'vitest';
import { fromDecimalString, fromInteger } from '../../src/shared/exact-number';
import { makeMark, makeReviewActionEntry } from '../helpers/builders';
import { snapshotAllStores } from '../helpers/store-snapshot';
import { createTestJournalHarness } from '../helpers/workspace-harness';

async function setupMultiDayAxio() {
  const h = await createTestJournalHarness('2026-11-06T15:00:00.000Z');
  const { tradeId } = await h.openLongStock({
    symbol: 'AXIO',
    entry: '50.00',
    stop: '47.00',
    target: '56.00',
    economicTime: '2026-11-06T15:00:00.000Z',
  });

  h.clock.setIso('2026-11-06T22:00:00.000Z');
  await h.marketData.save({
    kind: 'SaveManualMark',
    symbol: 'AXIO',
    sessionDate: '2026-11-06',
    price: '46.50',
    intent: 'Initial',
  });
  const rev1 = await h.dailyReview.open('2026-11-06');
  await h.dailyReview.save({
    kind: 'SaveTradeAction',
    tradeId,
    reviewDate: '2026-11-06',
    action: 'Hold',
    reason: 'Hold through Friday shakeout',
    conviction: 4,
    expectedSnapshot: rev1.expectedSnapshot,
  });

  h.clock.setIso('2026-11-09T22:00:00.000Z');
  await h.marketData.save({
    kind: 'AssertUnavailable',
    symbol: 'AXIO',
    sessionDate: '2026-11-09',
  });

  h.clock.setIso('2026-11-10T22:00:00.000Z');
  await h.marketData.save({
    kind: 'SaveManualMark',
    symbol: 'AXIO',
    sessionDate: '2026-11-10',
    price: '51.00',
    intent: 'Initial',
  });

  return { h, tradeId };
}

async function setupMultiDayClosedAsOfScenario() {
  const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
  const { tradeId, factRevision } = await h.openLongStock({
    symbol: 'ASOF',
    entry: '50.00',
    stop: '47.00',
    target: '56.00',
    economicTime: '2026-11-02T15:00:00.000Z',
  });
  h.clock.setIso('2026-11-03T22:00:00.000Z');
  await h.marketData.save({
    kind: 'AssertUnavailable',
    symbol: 'ASOF',
    sessionDate: '2026-11-03',
  });
  await h.persistence.runWriteTransaction(['market_marks', 'journal_entries'], async (tx) => {
    tx.put('market_marks', makeMark({ id: 'mk-2', symbol: 'ASOF', sessionDate: '2026-11-02', price: '51.00' }));
    tx.put('market_marks', makeMark({ id: 'mk-3', symbol: 'ASOF', sessionDate: '2026-11-03', price: '59.00' }));
    tx.put(
      'journal_entries',
      makeReviewActionEntry({ id: 'dtr-2', tradeId, reviewDate: '2026-11-02', action: 'Hold' }),
    );
    tx.put(
      'journal_entries',
      makeReviewActionEntry({ id: 'dtr-3', tradeId, reviewDate: '2026-11-03', action: 'Exit' }),
    );
  });

  h.clock.setIso('2026-11-03T19:00:00.000Z');
  await h.closeLongStock({
    tradeId,
    expectedFactRevision: factRevision,
    economicTime: '2026-11-03T19:00:00.000Z',
    fillPrice: '56.00',
    closeReasonId: h.closeReasonIds.targetReached,
  });
  return { h, tradeId };
}

describe('TradeViewsAndReporting.replayTrade seam', () => {
  it('returns NotFound when tradeId does not exist', async () => {
    const h = await createTestJournalHarness();
    const res = await h.views.replayTrade('trd-missing');
    expect(res).toEqual({ status: 'NotFound', tradeId: 'trd-missing' });
  });

  it('returns NotApplicable (UnenteredTrade) for an unentered Planned Trade', async () => {
    const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
    const plannedId = await h.createPlannedLongStock({
      symbol: 'PLND',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });

    const res = await h.views.replayTrade(plannedId);
    expect(res).toEqual({
      status: 'NotApplicable',
      tradeId: plannedId,
      reason: 'UnenteredTrade',
    });
  });

  it('returns IntegrityBlocked with exact reason when stored lifecycle disagrees with derived position facts', async () => {
    const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
    const { tradeId } = await h.openLongStock({
      symbol: 'CORR',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });

    await h.persistence.runWriteTransaction(['trades'], async (tx) => {
      const row = await tx.get('trades', tradeId);
      expect(row).toBeDefined();
      tx.put('trades', { ...row!, lifecycleState: 'Planned' });
    });

    const res = await h.views.replayTrade(tradeId);
    expect(res).toEqual({
      status: 'IntegrityBlocked',
      tradeId,
      reason: 'Stored lifecycle (Planned) disagrees with derived position (Open).',
    });
  });

  it('returns IntegrityBlocked with exact reason when a Trade record is missing its PlanVersion fact', async () => {
    const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
    const { tradeId } = await h.openLongStock({
      symbol: 'NOPV',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });

    await h.persistence.runWriteTransaction(['trade_facts'], async (tx) => {
      const facts = await tx.getAllByIndex('trade_facts', 'by_trade', tradeId);
      for (const f of facts) {
        if (f.kind === 'PlanVersion') {
          tx.delete('trade_facts', f.id);
        }
      }
    });

    const res = await h.views.replayTrade(tradeId);
    expect(res).toEqual({
      status: 'IntegrityBlocked',
      tradeId,
      reason: 'Missing initial PlanVersion fact.',
    });
  });

  it('skips weekends between entry and latest completed NYSE session', async () => {
    const { h, tradeId } = await setupMultiDayAxio();
    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;
    expect(res.view.replay.sessions.map((s) => s.sessionDate)).toEqual([
      '2026-11-06',
      '2026-11-09',
      '2026-11-10',
    ]);
  });

  it('binds Daily Review Hold actions onto matching Replay session points', async () => {
    const { h, tradeId } = await setupMultiDayAxio();
    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;
    expect(res.view.replay.sessions[0]!.reviewAction).toEqual({
      kind: 'Hold',
      reason: 'Hold through Friday shakeout',
      conviction: 4,
    });
  });

  it('preserves acknowledged Unavailable Marks as explicit missing-Mark gaps without interpolating P&L', async () => {
    const { h, tradeId } = await setupMultiDayAxio();
    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;
    expect(res.view.replay.sessions[1]!.missingMark).toBe(true);
    expect(res.view.replay.sessions[1]!.unavailableAcknowledged).toBe(true);
    expect(res.view.replay.sessions[1]!.totalPnl).toBeNull();
    expect(res.view.replay.sessions[2]!.totalPnl).toEqual(fromInteger(100));
  });

  it('forwards Hold action and breached Mark to reconcileStopDisciplineEpisodes with exact Rational overrun', async () => {
    const { h, tradeId } = await setupMultiDayAxio();
    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;
    expect(res.view.replay.stopDisciplineEpisodes).toHaveLength(1);
    expect(res.view.replay.stopDisciplineEpisodes[0]).toMatchObject({
      startSessionDate: '2026-11-06',
      endSessionDate: '2026-11-06',
      sessionCount: 1,
      maxOverrunDollars: fromDecimalString('-50.00'),
    });
  });

  it('bounds a Closed Trade at closedSessionDate and ignores later Marks for the same symbol', async () => {
    const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
    const { tradeId, factRevision } = await h.openLongStock({
      symbol: 'BREN',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });

    h.clock.setIso('2026-11-03T19:00:00.000Z');
    await h.closeLongStock({
      tradeId,
      expectedFactRevision: factRevision,
      economicTime: '2026-11-03T19:00:00.000Z',
      fillPrice: '56.00',
      closeReasonId: h.closeReasonIds.targetReached,
    });

    h.clock.setIso('2026-11-05T22:00:00.000Z');
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'BREN',
      sessionDate: '2026-11-05',
      price: '60.00',
      intent: 'Initial',
    });

    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;

    expect(res.view.replay.isClosed).toBe(true);
    expect(res.view.replay.sessions.map((s) => s.sessionDate)).toEqual([
      '2026-11-02',
      '2026-11-03',
    ]);
  });

  it('hydrates strategy, account, institution, closeReasonLabel, closedAtShort, and terminalDisposition cleanly on Ready view', async () => {
    const { h, tradeId } = await setupMultiDayClosedAsOfScenario();
    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;

    expect(res.view.strategyLabel).toBe('Long Stock');
    expect(res.view.accountLabel).toBe('Margin');
    expect(res.view.institutionLabel).toBe('Fidelity');
    expect(res.view.closeReasonLabel).toBe('Target Reached');
    expect(res.view.closedAtShort).toBe('Tue, Nov 3');
    expect(res.view.terminalDisposition).toBe('Closed via sale of 100 shares');
  });

  it('falls back to default catalog labels consistently when referenced catalog records are absent', async () => {
    const { h, tradeId } = await setupMultiDayClosedAsOfScenario();
    await h.persistence.runWriteTransaction(
      ['catalog_institutions', 'catalog_accounts', 'catalog_strategies'],
      async (tx) => {
        tx.delete('catalog_institutions', h.institutionId);
        tx.delete('catalog_accounts', h.accountId);
        tx.delete('catalog_strategies', h.strategyId);
      },
    );

    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;

    expect(res.view.strategyLabel).toBe('Long Stock');
    expect(res.view.accountLabel).toBe('Account');
    expect(res.view.institutionLabel).toBe('Institution');
  });

  it('caps sessions and open shares when asOfSessionDate precedes trade close without leaking future Nov 3 facts', async () => {
    const { h, tradeId } = await setupMultiDayClosedAsOfScenario();
    const fullCheck = await h.views.replayTrade(tradeId);
    expect(fullCheck.status === 'Ready' && fullCheck.view.replay.isClosed).toBe(true);

    const asOfNov2 = await h.views.replayTrade(tradeId, { asOfSessionDate: '2026-11-02' });
    expect(asOfNov2.status).toBe('Ready');
    if (asOfNov2.status !== 'Ready') return;

    expect(asOfNov2.view.replay.isClosed).toBe(false);
    expect(asOfNov2.view.replay.sessions.map((s) => s.sessionDate)).toEqual(['2026-11-02']);
    expect(asOfNov2.view.replay.sessions[0]!.openSharesDisplay).toBe('100');
    expect(asOfNov2.view.replay.sessions[0]!.totalPnl).toEqual(fromInteger(100));
    expect(asOfNov2.view.replay.sessions[0]!.reviewAction.kind).toBe('Hold');
  });

  it('omits closed disposition and closeReasonLabel when asOfSessionDate precedes trade close', async () => {
    const { h, tradeId } = await setupMultiDayClosedAsOfScenario();
    const asOfNov2 = await h.views.replayTrade(tradeId, { asOfSessionDate: '2026-11-02' });
    expect(asOfNov2.status).toBe('Ready');
    if (asOfNov2.status !== 'Ready') return;

    expect(asOfNov2.view.closeReasonLabel).toBeNull();
    expect(asOfNov2.view.closedAtShort).toBeNull();
    expect(asOfNov2.view.terminalDisposition).toBeNull();
  });

  it('returns NotApplicable (NotEnteredAsOf) when asOfSessionDate precedes first execution', async () => {
    const { h, tradeId } = await setupMultiDayClosedAsOfScenario();
    const res = await h.views.replayTrade(tradeId, { asOfSessionDate: '2026-10-30' });
    expect(res).toEqual({
      status: 'NotApplicable',
      tradeId,
      reason: 'NotEnteredAsOf',
    });
  });

  it('returns null closeReasonLabel when a closed Trade omits closeReasonId', async () => {
    const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
    const { tradeId, factRevision } = await h.openLongStock({
      symbol: 'NOCR',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });
    h.clock.setIso('2026-11-03T19:00:00.000Z');
    await h.closeLongStock({
      tradeId,
      expectedFactRevision: factRevision,
      economicTime: '2026-11-03T19:00:00.000Z',
      fillPrice: '53.00',
      closeReasonId: h.closeReasonIds.targetReached,
    });
    const closedView = await h.views.replayTrade(tradeId);
    expect(closedView.status === 'Ready' && closedView.view.replay.isClosed).toBe(true);

    await h.persistence.runWriteTransaction(['trades'], async (tx) => {
      const row = await tx.get('trades', tradeId);
      expect(row).toBeDefined();
      const withoutReason = { ...row! };
      delete (withoutReason as { closeReasonId?: string }).closeReasonId;
      tx.put('trades', withoutReason);
    });

    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;
    expect(res.view.closeReasonLabel).toBeNull();
  });

  it('falls back to last execution date when closedAt is missing on a Closed Trade', async () => {
    const { h, tradeId } = await setupMultiDayClosedAsOfScenario();
    await h.persistence.runWriteTransaction(['trades'], async (tx) => {
      const row = await tx.get('trades', tradeId);
      expect(row).toBeDefined();
      const withoutClosedAt = { ...row! };
      delete (withoutClosedAt as { closedAt?: string }).closedAt;
      tx.put('trades', withoutClosedAt);
    });

    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;
    expect(res.view.closedAtShort).toBe('Tue, Nov 3');
  });

  it('includes today closing session when a Trade is closed today during market hours (closedSessionDate > expectedSessionDate)', async () => {
    const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
    const { tradeId, factRevision } = await h.openLongStock({
      symbol: 'MKT',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });

    h.clock.setIso('2026-11-03T19:00:00.000Z');
    await h.closeLongStock({
      tradeId,
      expectedFactRevision: factRevision,
      economicTime: '2026-11-03T19:00:00.000Z',
      fillPrice: '56.00',
      closeReasonId: h.closeReasonIds.targetReached,
    });

    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;

    expect(res.view.replay.isClosed).toBe(true);
    expect(res.view.replay.sessions.map((s) => s.sessionDate)).toEqual([
      '2026-11-02',
      '2026-11-03',
    ]);
  });

  it('marks today unfinished market-hours entry session as inProgress (not missingMark) aligned with endSessionDate', async () => {
    // Clock = Tue Nov 3 15:00 UTC (10:00 ET, before 16:00 close) -> expectedSessionDate = Nov 2, live session = Nov 3
    const h = await createTestJournalHarness('2026-11-03T15:00:00.000Z');
    const { tradeId } = await h.openLongStock({
      symbol: 'NOWT',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-03T14:45:00.000Z',
    });

    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;

    expect(res.view.replay.sessions.map((s) => s.sessionDate)).toEqual(['2026-11-03']);
    expect(res.view.replay.sessions[0]!.inProgress).toBe(true);
    expect(res.view.replay.sessions[0]!.missingMark).toBe(false);
    expect(res.view.replay.missingMarkCount).toBe(0);
    expect(res.view.replay.sessions[0]!.reviewAction.kind).toBe('Pending');
  });

  it('is strictly read-only across all 21 workspace stores (snapshotAllStores before === after)', async () => {
    const h = await createTestJournalHarness('2026-11-02T15:00:00.000Z');
    const { tradeId } = await h.openLongStock({
      symbol: 'READ',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });
    h.clock.setIso('2026-11-03T22:00:00.000Z');
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'READ',
      sessionDate: '2026-11-02',
      price: '46.00',
      intent: 'Initial',
    });

    const before = await snapshotAllStores(h.persistence);
    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    const after = await snapshotAllStores(h.persistence);

    expect(after).toEqual(before);
  });

  it('throws on invalid asOfSessionDate before any early-return lookup', async () => {
    const h = await createTestJournalHarness('2026-11-03T22:00:00.000Z');
    await expect(h.views.replayTrade('trd-nonexistent', { asOfSessionDate: '2026/11/02' })).rejects.toThrow(
      'Invalid asOfSessionDate: 2026/11/02',
    );
  });

  it('caps future or unfinished asOfSessionDate to latestCompleted without emitting future missingMark sessions', async () => {
    const h = await createTestJournalHarness('2026-11-02T22:00:00.000Z');
    const { tradeId } = await h.openLongStock({
      symbol: 'CAPP',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'CAPP',
      sessionDate: '2026-11-02',
      price: '51.00',
      intent: 'Initial',
    });

    const res = await h.views.replayTrade(tradeId, { asOfSessionDate: '2026-11-10' });
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;
    expect(res.view.expectedSessionDate).toBe('2026-11-02');
    expect(res.view.replay.sessions.map((s) => s.sessionDate)).toEqual(['2026-11-02']);
    expect(res.view.replay.missingMarkCount).toBe(0);
  });

  it('ignores non-effective marks and non-Active unavailability acknowledgments in replayTrade', async () => {
    const h = await createTestJournalHarness('2026-11-02T22:00:00.000Z');
    const { tradeId } = await h.openLongStock({
      symbol: 'FILT',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-02T15:00:00.000Z',
    });
    await h.persistence.runWriteTransaction(['market_marks', 'market_acknowledgments'], async (tx) => {
      tx.put('market_marks', makeMark({ id: 'mk-ineff', symbol: 'FILT', sessionDate: '2026-11-02', price: '55.00', effective: false }));
      tx.put('market_acknowledgments', {
        id: 'ack-inactive',
        symbol: 'FILT',
        sessionDate: '2026-11-02',
        status: 'Revoked',
        createdAt: '2026-11-02T22:00:00.000Z',
        updatedAt: '2026-11-02T22:00:00.000Z',
      } as never);
    });

    const res = await h.views.replayTrade(tradeId);
    expect(res.status).toBe('Ready');
    if (res.status !== 'Ready') return;
    expect(res.view.replay.sessions[0]!.mark).toBeNull();
    expect(res.view.replay.sessions[0]!.missingMark).toBe(true);
    expect(res.view.replay.sessions[0]!.unavailableAcknowledged).toBe(false);
  });
});
