import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { CLOSE_REASON_SEEDS, createReferenceCatalog } from '../../src/catalog/reference-catalog';
import { createDailyReview } from '../../src/daily-review/daily-review';
import {
  createJournal,
  DAILY_TRADE_REVIEW_DEF_ID,
  PLAN_REFLECTION_TYPE_ID,
} from '../../src/journal/journal';
import { createMarketData } from '../../src/market-data/market-data';
import { createPersistenceSeam } from '../../src/persistence/idb';
import { createRuntimeReadinessController } from '../../src/runtime/readiness';
import { createManualClock } from '../../src/shared/clock';
import { createTradeViews } from '../../src/trade-views/trade-views';
import { createTradeWorkflows } from '../../src/trade-workflows/trade-workflows';
import { createWorkspace } from '../../src/workspace/workspace';

async function setupD6WorkflowsHarness(autoOpen = true) {
  const idb = new IDBFactory();
  const clock = createManualClock('2026-11-18T15:00:00.000Z');
  const gateHolder: {
    checkWritable: ReturnType<typeof createRuntimeReadinessController>['checkWritable'];
  } = {
    checkWritable: () => ({ writable: true }),
  };
  const persistence = createPersistenceSeam({
    indexedDB: idb,
    writeGate: { checkWritable: () => gateHolder.checkWritable() },
  });
  const readiness = createRuntimeReadinessController({
    clock,
    probes: {
      runStorageDiagnostic: () => persistence.runDiagnosticProbe(),
      inspectRoot: () => persistence.inspectRoot(),
      estimateCapacity: async () => ({
        supported: true,
        quotaBytes: 500 * 1024 * 1024,
        usageBytes: 5 * 1024 * 1024,
      }),
      checkServiceWorkerControl: async () => ({ controlled: true, releaseId: 'rel-d6' }),
      verifyOfflineInventory: async () => ({ valid: true, releaseId: 'rel-d6', assetCount: 6 }),
      checkStorageProtection: async () => ({ state: 'Protected' }),
    },
  });
  gateHolder.checkWritable = () => readiness.checkWritable();

  const catalog = createReferenceCatalog({ persistence, clock });
  const journal = createJournal({ persistence, clock });
  const workspace = createWorkspace({
    persistence,
    readiness,
    catalog,
    journal,
    clock,
    requestPersistentStorage: async () => ({ state: 'Protected' }),
  });
  const workflows = createTradeWorkflows({ persistence, clock });
  const views = createTradeViews({ persistence, clock });
  const marketData = createMarketData({ persistence, clock });
  const dailyReview = createDailyReview({ persistence, clock });

  await workspace.initialize({ proposedTimeZone: 'America/New_York' });
  const inst = await catalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
  if (inst.status !== 'Saved' || inst.family !== 'Institution') throw new Error('inst');
  const acct = await catalog.save({
    kind: 'CreateAccount',
    institutionId: inst.record.id,
    label: 'Margin',
  });
  if (acct.status !== 'Saved' || acct.family !== 'Account') throw new Error('acct');
  const strats = await catalog.query({ family: 'Strategy', includeInactive: false });
  if (strats.family !== 'Strategy' || !strats.items[0]) throw new Error('strat');
  const defs = await journal.getDefinitions();
  const planDef = defs.definitions.find((d) => d.entryTypeId === PLAN_REFLECTION_TYPE_ID)!;

  const plan = await workflows.confirmPlan({
    accountId: acct.record.id,
    strategyId: strats.items[0].id,
    symbol: 'NVDA',
    quantity: '100',
    intendedEntryPrice: '140.00',
    stopPrice: '132.00',
    targetPrice: '164.00',
    economicTime: '2026-11-18T15:00:00.000Z',
    planReflection: {
      definitionId: planDef.id,
      definitionRevision: planDef.revision,
      thesis: 'Breakout above 6-week base',
      invalidation: 'Close below 132',
    },
  });
  if (plan.status !== 'Confirmed') throw new Error('plan');
  const tradeId = plan.postCommit.trade.id;

  if (autoOpen) {
    const openRes = await workflows.recordPositionChange({
      tradeId,
      expectedFactRevision: 1,
      economicTime: '2026-11-18T15:05:00.000Z',
      executions: [
        { quantity: '60', fillPrice: '140.00', fee: '1.20', plannedLegIntent: 'PlannedLeg' },
        { quantity: '40', fillPrice: '142.00', fee: '0.80', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    if (openRes.status !== 'Recorded') throw new Error('open');
  }

  return { tradeId, persistence, catalog, journal, workflows, views, marketData, dailyReview, clock };
}

describe('TradeWorkflows.recordPositionChange (D6 Partial & Closing Exits) seam', () => {
  it('supports partial Sell with FIFO Lot Matches, rejects oversell, requires Close Reason on final close, and exposes Closed Cockpit detail', async () => {
    const h = await setupD6WorkflowsHarness();

    // 1. Oversell > 100 shares rejected
    const oversell = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 2,
      economicTime: '2026-11-19T15:00:00.000Z',
      executions: [
        { side: 'Sell', quantity: '110', fillPrice: '150.00', fee: '1.00', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(oversell.status).toBe('Rejected');

    // 2. Partial Sell of 70 shares keeps Trade Open and persists 2 FIFO LotMatchRecords
    const partial = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 2,
      economicTime: '2026-11-19T15:00:00.000Z',
      executions: [
        { side: 'Sell', quantity: '70', fillPrice: '150.00', fee: '1.40', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(partial.status).toBe('Recorded');
    if (partial.status !== 'Recorded') return;
    expect(partial.postCommit.trade.lifecycleState).toBe('Open');
    expect(partial.postCommit.derived.openSharesDisplay).toBe('30');
    expect(partial.postCommit.derived.lotMatches).toHaveLength(2);
    // 60*(150-140) - 1.20 - 1.20 = +$597.60; 10*(150-142) - 0.20 - 0.20 = +$79.60 -> Total +$677.20
    expect(partial.postCommit.derived.realizedPnlDisplay).toBe('+$677.20');

    // 3. Final Sell of 30 shares WITHOUT Close Reason must be rejected
    const noReasonClose = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 3,
      economicTime: '2026-11-20T15:00:00.000Z',
      executions: [
        { side: 'Sell', quantity: '30', fillPrice: '164.00', fee: '0.60', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(noReasonClose.status).toBe('Rejected');

    // 4. Final Sell WITH valid Target Reached Close Reason transitions Open -> Closed atomically
    const targetReasonId = CLOSE_REASON_SEEDS.find((c) => c.productKey === 'target-reached')!.id;
    const closed = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 3,
      economicTime: '2026-11-20T15:00:00.000Z',
      executions: [
        { side: 'Sell', quantity: '30', fillPrice: '164.00', fee: '0.60', plannedLegIntent: 'PlannedLeg' },
      ],
      closeReasonId: targetReasonId,
      reflection: { kind: 'Defer' },
    });
    expect(closed.status).toBe('Recorded');
    if (closed.status !== 'Recorded') return;
    expect(closed.postCommit.trade.lifecycleState).toBe('Closed');
    expect(closed.postCommit.trade.closeReasonId).toBe(targetReasonId);
    expect(closed.postCommit.trade.terminalDisposition).toBe('Closed via sale of 100 shares');
    // Last 30 sh: 30*(164-142) - 0.60 - 0.60 = 660 - 1.20 = +$658.80; Total realized = 677.20 + 658.80 = +$1,336.00
    expect(closed.postCommit.derived.realizedPnlDisplay).toBe('+$1,336.00');
    expect(closed.postCommit.derived.entryExitScaling).toBe('Scaled');

    // 5. Verify LotMatchRecords in IDB never duplicate price or P&L and Closed Trade shows up in Closed browse + Cockpit detail
    const lotMatchRows = await h.persistence.runReadTransaction(['lot_matches'], (tx) =>
      tx.getAllByIndex('lot_matches', 'by_trade', h.tradeId),
    );
    expect(lotMatchRows).toHaveLength(3);
    expect('realizedPnl' in (lotMatchRows[0] ?? {})).toBe(false);

    const closedBrowse = await h.views.browseTrades({ lifecycleState: 'Closed' });
    expect(closedBrowse.items).toHaveLength(1);
    expect(closedBrowse.items[0]?.closeReasonLabel).toBe('Target Reached');

    const detail = await h.views.getTradeDetail(h.tradeId);
    expect(detail?.closeReasonLabel).toBe('Target Reached');
    expect(detail?.derived.feeReconciliation.openingFeesUnconsumedDisplay).toBe('$0.00');
  });

  it('rejects closeReasonId on partial Sell, reconciles StopDiscipline on Sell, seeds revision-2 DTR on fresh boot, and bounds Closed History/Marks/ReviewMarksView properly', async () => {
    const h = await setupD6WorkflowsHarness(false);

    // OCR #24/#34: fresh init seeds Daily Trade Review definition at revision 2 with Hold & Exit
    const defs = await h.journal.getDefinitions();
    const dtrDef = defs.definitions.find((d) => d.id === DAILY_TRADE_REVIEW_DEF_ID);
    expect(dtrDef?.revision).toBe(2);

    // Put a pre-entry Stop breach Mark on 2026-11-16 and post-entry breach Mark on 2026-11-18
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-16',
      price: '125.00',
      intent: 'Initial',
    });

    await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 1,
      economicTime: '2026-11-18T15:00:00.000Z',
      executions: [
        { side: 'Buy', quantity: '100', fillPrice: '140.00', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });

    h.clock.setIso('2026-11-18T22:00:00.000Z');
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-18',
      price: '130.00',
      intent: 'Initial',
    });
    const rev18 = await h.dailyReview.open('2026-11-18');
    const hold18 = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: h.tradeId,
      reviewDate: '2026-11-18',
      action: 'Hold',
      reason: 'Watching close',
      expectedSnapshot: rev18.expectedSnapshot,
    });
    expect(hold18.status).toBe('Saved');

    const devsBeforeSell = await h.persistence.runReadTransaction(['deviations'], (tx) =>
      tx.getAllByIndex('deviations', 'by_trade', h.tradeId),
    );
    expect(devsBeforeSell.filter((d) => d.kind === 'StopDiscipline' && !d.voided)).toHaveLength(1);
    expect(devsBeforeSell[0]?.maxOverrunDisplay).toBe('-$200.00');

    // OCR #22: Partial Sell supplying closeReasonId is Rejected rather than ignored
    const targetReasonId = CLOSE_REASON_SEEDS.find((c) => c.productKey === 'target-reached')!.id;
    h.clock.setIso('2026-11-19T22:00:00.000Z');
    const partialWithReason = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 2,
      economicTime: '2026-11-19T15:00:00.000Z',
      executions: [
        { side: 'Sell', quantity: '40', fillPrice: '145.00', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      closeReasonId: targetReasonId,
      reflection: { kind: 'Defer' },
    });
    expect(partialWithReason.status).toBe('Rejected');

    // Valid partial exit (40 sh @ $145 -> realized +$200) -> ReviewMarksView should report realizedRDisplay!
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-19',
      price: '146.00',
      intent: 'Initial',
    });
    const partialOk = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 2,
      economicTime: '2026-11-19T15:00:00.000Z',
      executions: [
        { side: 'Sell', quantity: '40', fillPrice: '145.00', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(partialOk.status).toBe('Recorded');
    const marksView = await h.views.getReviewMarksView('2026-11-19');
    const nvdaRow = marksView.openTrades.find((t) => t.id === h.tradeId);
    expect(nvdaRow?.realizedRDisplay).toBe('+0.25R');

    // Backdated Sell of 60 sh at 2026-11-18T16:00:00Z closes overall position (60@Nov18 + 40@Nov19 = 100),
    // leaving 40 open at Nov 18 cutoff -> StopDiscipline shrinks overrun from -$200 to -$80 atomically!
    const backClose = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 3,
      economicTime: '2026-11-18T16:00:00.000Z',
      executions: [
        { side: 'Sell', quantity: '60', fillPrice: '165.00', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      closeReasonId: targetReasonId,
      reflection: { kind: 'Defer' },
    });
    expect(backClose.status).toBe('Recorded');

    const devsAfterBackClose = await h.persistence.runReadTransaction(['deviations'], (tx) =>
      tx.getAllByIndex('deviations', 'by_trade', h.tradeId),
    );
    const activeAfterBackClose = devsAfterBackClose.filter((d) => d.kind === 'StopDiscipline' && !d.voided);
    expect(activeAfterBackClose).toHaveLength(1);
    expect(activeAfterBackClose[0]?.maxOverrunDisplay).toBe('-$80.00');

    // OCR #28 & #29: Mark on 2026-11-23 AFTER closure (Nov 19 last sell) + Mark BEFORE entry (Nov 16)
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-23',
      price: '120.00',
      intent: 'Initial',
    });
    h.clock.setIso('2026-11-23T22:00:00.000Z');
    const closedDetail = await h.views.getTradeDetail(h.tradeId);
    // Stop was breached only on Nov 18 (NOT Nov 16 pre-entry!), Target never breached via marks after close
    expect(closedDetail?.planVsActual?.stopFirstReachedShort).toBe('Wed, Nov 18');
    expect(closedDetail?.planVsActual?.targetFirstReachedShort).toBeNull();
    // Price history stops on Nov 19 (final disposal date), not extending to Nov 23, and shows realized P&L on Nov 19!
    expect(closedDetail?.priceHistory.map((r) => r.sessionDate)).toEqual(['2026-11-19', '2026-11-18']);
    expect(closedDetail?.priceHistory[0]?.tradePnlDisplay).toBe('+$1,700.00');

    // Separate trade: closing ALL 100 shares on breach date voids the StopDiscipline episode atomically inside recordPositionChange!
    const hVoid = await setupD6WorkflowsHarness(true);
    hVoid.clock.setIso('2026-11-18T22:00:00.000Z');
    await hVoid.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-18',
      price: '130.00',
      intent: 'Initial',
    });
    const voidRev18 = await hVoid.dailyReview.open('2026-11-18');
    const voidHold = await hVoid.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: hVoid.tradeId,
      reviewDate: '2026-11-18',
      action: 'Hold',
      reason: 'Watching close',
      expectedSnapshot: voidRev18.expectedSnapshot,
    });
    expect(voidHold.status).toBe('Saved');
    const fullBackClose = await hVoid.workflows.recordPositionChange({
      tradeId: hVoid.tradeId,
      expectedFactRevision: 2,
      economicTime: '2026-11-18T16:00:00.000Z',
      executions: [
        { side: 'Sell', quantity: '100', fillPrice: '131.00', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      closeReasonId: targetReasonId,
      reflection: { kind: 'Defer' },
    });
    expect(fullBackClose.status).toBe('Recorded');
    const voidedDevs = await hVoid.persistence.runReadTransaction(['deviations'], (tx) =>
      tx.getAllByIndex('deviations', 'by_trade', hVoid.tradeId),
    );
    expect(voidedDevs.filter((d) => d.kind === 'StopDiscipline' && !d.voided)).toHaveLength(0);
    expect(voidedDevs.some((d) => d.kind === 'StopDiscipline' && d.voided)).toBe(true);
  });

  it('rejects recordPositionChange on an already-Closed Trade with zero writes', async () => {
    const h = await setupD6WorkflowsHarness(true);
    const { ExactNumber, add, sub, fromInteger, formatQuantityString } = await import(
      '../../src/shared/exact-number'
    );

    const readTradeState = () =>
      h.persistence.runReadTransaction(
        ['trades', 'executions', 'position_changes', 'lot_matches'],
        async (tx) => ({
          trade: await tx.get('trades', h.tradeId),
          execs: await tx.getAllByIndex('executions', 'by_trade', h.tradeId),
          pcs: await tx.getAllByIndex('position_changes', 'by_trade', h.tradeId),
          lots: await tx.getAllByIndex('lot_matches', 'by_trade', h.tradeId),
        }),
      );

    const before = await readTradeState();
    let totalOpen = fromInteger(0);
    for (const ex of before.execs) {
      const q = ExactNumber.fromJSON(ex.quantity);
      totalOpen = ex.side === 'Buy' ? add(totalOpen, q) : sub(totalOpen, q);
    }
    const openQty = formatQuantityString(totalOpen);
    const buyMs = Math.max(...before.execs.map((e) => Date.parse(e.economicTime)));
    const closeTime = new Date(buyMs + 60_000).toISOString();
    h.clock.setIso(closeTime);

    const closed = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: before.trade!.factRevision,
      economicTime: closeTime,
      executions: [
        {
          side: 'Sell',
          quantity: openQty,
          fillPrice: '110.00',
          fee: '0.00',
          plannedLegIntent: 'PlannedLeg',
        },
      ],
      closeReasonId: 'cr_target_reached',
      reflection: { kind: 'Defer' },
    });
    expect(closed.status).toBe('Recorded');
    if (closed.status !== 'Recorded') return;
    expect(closed.postCommit.trade.lifecycleState).toBe('Closed');
    const afterClose = await readTradeState();

    const afterCloseTime = new Date(buyMs + 120_000).toISOString();
    h.clock.setIso(afterCloseTime);
    const rejected = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: closed.postCommit.trade.factRevision,
      economicTime: afterCloseTime,
      executions: [
        {
          side: 'Buy',
          quantity: '10',
          fillPrice: '111.00',
          fee: '0.00',
          plannedLegIntent: 'ExplicitlyUnplanned',
        },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(rejected.status).toBe('Rejected');
    if (rejected.status === 'Rejected') {
      expect(rejected.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'tradeId',
            message: expect.stringMatching(/Closed/i),
          }),
        ]),
      );
    }

    const after = await readTradeState();
    expect(after.trade?.factRevision).toBe(closed.postCommit.trade.factRevision);
    expect(after.execs).toHaveLength(afterClose.execs.length);
    expect(after.pcs).toHaveLength(afterClose.pcs.length);
    expect(after.lots).toHaveLength(afterClose.lots.length);
  });

  it('rejects a backdated Sell earlier than the first Buy (oversold across economic-time-sorted fills) with zero writes', async () => {
    const h = await setupD6WorkflowsHarness(true);

    const before = await h.persistence.runReadTransaction(['trades', 'executions'], async (tx) => ({
      trade: await tx.get('trades', h.tradeId),
      execs: await tx.getAllByIndex('executions', 'by_trade', h.tradeId),
    }));
    const buyMs = Math.min(...before.execs.map((e) => Date.parse(e.economicTime)));
    const earlierTime = new Date(buyMs - 60_000).toISOString();

    const rejected = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: before.trade!.factRevision,
      economicTime: earlierTime,
      executions: [
        {
          side: 'Sell',
          quantity: '10',
          fillPrice: '105.00',
          fee: '0.00',
          plannedLegIntent: 'PlannedLeg',
        },
      ],
      reflection: { kind: 'Defer' },
    });

    expect(rejected.status).toBe('Rejected');
    if (rejected.status === 'Rejected') {
      expect(rejected.errors).toEqual([
        expect.objectContaining({
          field: 'executions',
          message: expect.stringContaining('exceeds shares open'),
        }),
      ]);
    }
    const after = await h.persistence.runReadTransaction(['trades', 'executions'], async (tx) => ({
      trade: await tx.get('trades', h.tradeId),
      execs: await tx.getAllByIndex('executions', 'by_trade', h.tradeId),
    }));
    expect(after.trade?.factRevision).toBe(before.trade!.factRevision);
    expect(after.execs).toHaveLength(before.execs.length);
  });

  it('rejects full close when closeReasonId is unknown or Archived with zero writes', async () => {
    const h = await setupD6WorkflowsHarness(true);
    const { ExactNumber, add, sub, fromInteger, formatQuantityString } = await import(
      '../../src/shared/exact-number'
    );

    const before = await h.persistence.runReadTransaction(['trades', 'executions'], async (tx) => ({
      trade: await tx.get('trades', h.tradeId),
      execs: await tx.getAllByIndex('executions', 'by_trade', h.tradeId),
    }));
    let totalOpen = fromInteger(0);
    for (const ex of before.execs) {
      const q = ExactNumber.fromJSON(ex.quantity);
      totalOpen = ex.side === 'Buy' ? add(totalOpen, q) : sub(totalOpen, q);
    }
    const openQty = formatQuantityString(totalOpen);
    const buyMs = Math.max(...before.execs.map((e) => Date.parse(e.economicTime)));
    const closeTime = new Date(buyMs + 60_000).toISOString();
    h.clock.setIso(closeTime);

    const seedRes = await h.persistence.runWriteTransaction(['catalog_close_reasons'], async (tx) => {
      await tx.put('catalog_close_reasons', {
        id: 'cr_archived_test',
        productKey: 'archived-test',
        currentLabel: 'Archived Test Reason',
        normalizedLabel: 'archived test reason',
        status: 'Archived',
        revision: 2,
        createdAt: closeTime,
        updatedAt: closeTime,
        history: [
          {
            revision: 1,
            action: 'Created',
            label: 'Archived Test Reason',
            status: 'Active',
            recordedAt: closeTime,
          },
          {
            revision: 2,
            action: 'Archived',
            label: 'Archived Test Reason',
            status: 'Archived',
            recordedAt: closeTime,
          },
        ],
      });
    });
    expect(seedRes.status).toBe('Committed');

    for (const badReasonId of ['cr_unknown_reason', 'cr_archived_test']) {
      const rejected = await h.workflows.recordPositionChange({
        tradeId: h.tradeId,
        expectedFactRevision: before.trade!.factRevision,
        economicTime: closeTime,
        executions: [
          {
            side: 'Sell',
            quantity: openQty,
            fillPrice: '110.00',
            fee: '0.00',
            plannedLegIntent: 'PlannedLeg',
          },
        ],
        closeReasonId: badReasonId,
        reflection: { kind: 'Defer' },
      });
      expect(rejected.status).toBe('Rejected');
      if (rejected.status === 'Rejected') {
        expect(rejected.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'closeReasonId',
              message: expect.stringMatching(/Close Reason/i),
            }),
          ]),
        );
      }
    }

    const after = await h.persistence.runReadTransaction(['trades', 'executions'], async (tx) => ({
      trade: await tx.get('trades', h.tradeId),
      execs: await tx.getAllByIndex('executions', 'by_trade', h.tradeId),
    }));
    expect(after.trade?.lifecycleState).toBe('Open');
    expect(after.trade?.factRevision).toBe(before.trade!.factRevision);
    expect(after.execs).toHaveLength(before.execs.length);
  });
});
