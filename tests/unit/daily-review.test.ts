import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createReferenceCatalog } from '../../src/catalog/reference-catalog';
import { createDailyReview } from '../../src/daily-review/daily-review';
import {
  createJournal,
  DAILY_TRADE_REVIEW_TYPE_ID,
  PLAN_REFLECTION_TYPE_ID,
  POSITION_CHANGE_REFLECTION_TYPE_ID,
} from '../../src/journal/journal';
import { createMarketData } from '../../src/market-data/market-data';
import { createPersistenceSeam } from '../../src/persistence/idb';
import { createRuntimeReadinessController } from '../../src/runtime/readiness';
import { createManualClock } from '../../src/shared/clock';
import { createTradeWorkflows } from '../../src/trade-workflows/trade-workflows';
import { createWorkspace } from '../../src/workspace/workspace';

async function createD5Harness() {
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
      checkServiceWorkerControl: async () => ({ controlled: true, releaseId: 'rel-d5' }),
      verifyOfflineInventory: async () => ({ valid: true, releaseId: 'rel-d5', assetCount: 6 }),
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
  const pcDef = defs.definitions.find((d) => d.entryTypeId === POSITION_CHANGE_REFLECTION_TYPE_ID)!;

  const accountId = acct.record.id;
  const strategyId = strats.items[0].id;

  async function openLongStock(opts: {
    symbol: string;
    entry: string;
    stop: string;
    target: string;
    economicTime: string;
    deferReflection?: boolean;
  }): Promise<string> {
    const plan = await workflows.confirmPlan({
      accountId,
      strategyId,
      symbol: opts.symbol,
      quantity: '100',
      intendedEntryPrice: opts.entry,
      stopPrice: opts.stop,
      targetPrice: opts.target,
      economicTime: opts.economicTime,
      planReflection: {
        definitionId: planDef.id,
        definitionRevision: planDef.revision,
        thesis: `${opts.symbol} breakout`,
        invalidation: `Close below ${opts.stop}`,
      },
    });
    if (plan.status !== 'Confirmed') throw new Error(`plan failed: ${plan.status}`);
    const tradeId = plan.postCommit.trade.id;

    const fill = await workflows.recordPositionChange({
      tradeId,
      expectedFactRevision: 1,
      economicTime: opts.economicTime,
      executions: [
        { quantity: '100', fillPrice: opts.entry, fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: opts.deferReflection
        ? { kind: 'Defer' }
        : {
            kind: 'Complete',
            definitionId: pcDef.id,
            definitionRevision: pcDef.revision,
            decisionMode: 'As Planned',
            primaryEmotion: 'Calm',
            decisionConfidence: 4,
            note: 'Clean fill.',
          },
    });
    if (fill.status !== 'Recorded') throw new Error(`fill failed: ${fill.status}`);
    return tradeId;
  }

  return {
    clock,
    persistence,
    journal,
    workflows,
    marketData,
    dailyReview,
    openLongStock,
    accountId: acct.record.id,
    strategyId: strats.items[0].id,
    planDef,
  };
}

describe('D5 DailyReview coordinator seam', () => {
  it('filters Open Trades via StateAtEconomicCutoff, ranks by urgency, enforces Marks-before-Action, and handles OV-02 strict Hold vs one-click Hold', async () => {
    const h = await createD5Harness();

    // Trade 1 (AXIO) opened 2026-11-18 with deferred reflection
    const axioId = await h.openLongStock({
      symbol: 'AXIO',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-18T15:00:00.000Z',
      deferReflection: true,
    });

    // Trade 2 (NVDA) opened 2026-11-20 (not yet open on 2026-11-19!)
    const nvdaId = await h.openLongStock({
      symbol: 'NVDA',
      entry: '140.00',
      stop: '132.00',
      target: '164.00',
      economicTime: '2026-11-20T15:00:00.000Z',
      deferReflection: false,
    });

    // Trade 3 (AAPL) stays Planned -> excluded from Daily Review
    await h.workflows.confirmPlan({
      accountId: h.accountId,
      strategyId: h.strategyId,
      symbol: 'AAPL',
      quantity: '50',
      intendedEntryPrice: '200.00',
      stopPrice: '190.00',
      targetPrice: '220.00',
      economicTime: '2026-11-18T15:00:00.000Z',
      planReflection: {
        definitionId: h.planDef.id,
        definitionRevision: h.planDef.revision,
        thesis: 'Watchlist',
        invalidation: 'Below 190',
      },
    });

    // 1. Cutoff 2026-11-19 includes ONLY AXIO, and surfaces NVDA (opened 2026-11-20) in openedAfterCutoffTrades
    const rev19 = await h.dailyReview.open('2026-11-19');
    expect(rev19.trades.map((t) => t.symbol)).toEqual(['AXIO']);
    expect(rev19.openedAfterCutoffTrades.map((t) => t.symbol)).toEqual(['NVDA']);

    // 2. Cutoff 2026-11-20 includes AXIO and NVDA; Marks-before-Action blocks Hold before Marks exist
    h.clock.setIso('2026-11-20T22:00:00.000Z');
    const rev20BeforeMarks = await h.dailyReview.open();
    expect(rev20BeforeMarks.reviewDate).toBe('2026-11-20');
    expect(rev20BeforeMarks.trades.map((t) => t.symbol).sort()).toEqual(['AXIO', 'NVDA']);
    expect(rev20BeforeMarks.completionState).toBe('Incomplete');

    const blockedBeforeMark = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: nvdaId,
      reviewDate: '2026-11-20',
      action: 'Hold',
      expectedSnapshot: rev20BeforeMarks.expectedSnapshot,
    });
    expect(blockedBeforeMark.status).toBe('Rejected');

    // 3. Enter Marks: AXIO = $45.50 (Past Stop!), NVDA = $144.00 (Inside lines)
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AXIO',
      sessionDate: '2026-11-20',
      price: '45.50',
      intent: 'Initial',
    });
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-20',
      price: '144.00',
      intent: 'Initial',
    });

    const rev20 = await h.dailyReview.open();
    // Attention ranking: AXIO (Past Stop) MUST rank #1 ahead of NVDA (Inside lines)
    expect(rev20.trades.map((t) => t.symbol)).toEqual(['AXIO', 'NVDA']);
    expect(rev20.trades[0]?.strict).toBe(true);
    expect(rev20.trades[1]?.strict).toBe(false);

    // 4. OV-02 strict rule: Past Stop rejects Hold without a reason
    const noReasonPastStop = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioId,
      reviewDate: '2026-11-20',
      action: 'Hold',
      reason: '   ',
      expectedSnapshot: rev20.expectedSnapshot,
    });
    expect(noReasonPastStop.status).toBe('Rejected');

    // Past Stop succeeds with explicit reason
    const savedAxio = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioId,
      reviewDate: '2026-11-20',
      action: 'Hold',
      reason: 'Oversold; watching for bounce to 47.',
      conviction: 2,
      expectedSnapshot: rev20.expectedSnapshot,
    });
    expect(savedAxio.status).toBe('Saved');

    // Inside lines: one-click Hold with NO reason succeeds
    const revAfterAxio = await h.dailyReview.open();
    const savedNvda = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: nvdaId,
      reviewDate: '2026-11-20',
      action: 'Hold',
      expectedSnapshot: revAfterAxio.expectedSnapshot,
    });
    expect(savedNvda.status).toBe('Saved');

    // 5. Still Incomplete because AXIO's deferred Position Change Reflection Debt is still due!
    const revBeforeDebt = await h.dailyReview.open();
    expect(revBeforeDebt.dueDebt).toHaveLength(1);
    expect(revBeforeDebt.completionState).toBe('Incomplete');

    // Resolve Debt via Complete -> creates immutable Entry and marks Debt Settled atomically
    const debtId = revBeforeDebt.dueDebt[0]!.debt.id;
    const settled = await h.dailyReview.save({
      kind: 'ResolveReviewDebt',
      debtId,
      reviewDate: '2026-11-20',
      mode: 'Complete',
      decisionMode: 'As Planned',
      primaryEmotion: 'Calm',
      confidence: 4,
      note: 'Entered cleanly at the open.',
      expectedSnapshot: revBeforeDebt.expectedSnapshot,
    });
    expect(settled.status).toBe('Saved');

    // 6. Now derived completionState === 'Complete' (zero Review Session entity)
    const revDone = await h.dailyReview.open();
    expect(revDone.dueDebt).toHaveLength(0);
    expect(revDone.completionState).toBe('Complete');

    // Saved Daily Trade Review entries exist in Journal with unique obligationKey
    const dtrEntries = await h.journal.query({ entryTypeId: DAILY_TRADE_REVIEW_TYPE_ID });
    expect(dtrEntries.items).toHaveLength(2);
  });

  it('rejects stale ExpectedSnapshot on Mark change with zero writes (AC-REV-005), supports Debt Decline without blank Entry, and derives CompleteWithUnavailableMarks', async () => {
    const h = await createD5Harness();
    const tradeId = await h.openLongStock({
      symbol: 'MSFT',
      entry: '400.00',
      stop: '380.00',
      target: '440.00',
      economicTime: '2026-11-18T15:00:00.000Z',
      deferReflection: true,
    });

    h.clock.setIso('2026-11-20T22:00:00.000Z');
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'MSFT',
      sessionDate: '2026-11-20',
      price: '410.00',
      intent: 'Initial',
    });

    const staleView = await h.dailyReview.open();

    // Mark changes behind the scenes -> marketSnapshotId increments
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'MSFT',
      sessionDate: '2026-11-20',
      price: '375.00',
      intent: 'Correction',
    });

    // Saving against staleView.expectedSnapshot MUST return ReviewChanged with zero writes
    const staleSave = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId,
      reviewDate: '2026-11-20',
      action: 'Hold',
      expectedSnapshot: staleView.expectedSnapshot,
    });
    expect(staleSave.status).toBe('ReviewChanged');
    const entriesAfterStale = await h.journal.query({ entryTypeId: DAILY_TRADE_REVIEW_TYPE_ID });
    expect(entriesAfterStale.items).toHaveLength(0);

    // Decline due Debt -> never creates a blank Journal Entry
    const freshView = await h.dailyReview.open();
    const debtId = freshView.dueDebt[0]!.debt.id;
    const declined = await h.dailyReview.save({
      kind: 'ResolveReviewDebt',
      debtId,
      reviewDate: '2026-11-20',
      mode: 'Decline',
      declineReason: 'Nothing notable to add.',
      expectedSnapshot: freshView.expectedSnapshot,
    });
    expect(declined.status).toBe('Saved');

    // Open a second trade (TSLA) marked Unavailable -> CompleteWithUnavailableMarks
    const tslaId = await h.openLongStock({
      symbol: 'TSLA',
      entry: '250.00',
      stop: '230.00',
      target: '290.00',
      economicTime: '2026-11-18T15:00:00.000Z',
      deferReflection: false,
    });
    await h.marketData.save({
      kind: 'AssertUnavailable',
      symbol: 'TSLA',
      sessionDate: '2026-11-20',
      reason: 'Halted',
    });

    const v2 = await h.dailyReview.open();
    await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId,
      reviewDate: '2026-11-20',
      action: 'Hold',
      reason: 'Holding past stop on earnings dip.',
      expectedSnapshot: v2.expectedSnapshot,
    });
    const v3 = await h.dailyReview.open();
    await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: tslaId,
      reviewDate: '2026-11-20',
      action: 'Hold',
      expectedSnapshot: v3.expectedSnapshot,
    });

    const finalRev = await h.dailyReview.open();
    expect(finalRev.completionState).toBe('CompleteWithUnavailableMarks');

    // Mismatched expectedSnapshot.reviewDate -> ReviewChanged with zero writes
    const badDateSave = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId,
      reviewDate: '2026-11-19',
      action: 'Hold',
      reason: 'Wrong date',
      expectedSnapshot: finalRev.expectedSnapshot,
    });
    expect(badDateSave.status).toBe('ReviewChanged');

    // Trade missing from expectedSnapshot -> ReviewChanged with zero writes
    const missingFromSnap = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId,
      reviewDate: '2026-11-20',
      action: 'Hold',
      reason: 'Missing key',
      expectedSnapshot: {
        ...finalRev.expectedSnapshot,
        tradeFactRevisions: {},
      },
    });
    expect(missingFromSnap.status).toBe('ReviewChanged');
  });
});
