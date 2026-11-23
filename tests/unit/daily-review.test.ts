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

  it('reconciles continuous StopDiscipline deviations atomically, supports Exit (OV-02/OV-05) without duplicates, and keeps cutoff eligibility after closing', async () => {
    const h = await createD5Harness();
    const axioId = await h.openLongStock({
      symbol: 'AXIO',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-18T15:00:00.000Z',
      deferReflection: false,
    });

    // Day 1 (Nov 18): Past Stop ($46.00) -> Hold -> creates 1 StopDiscipline Deviation
    h.clock.setIso('2026-11-18T22:00:00.000Z');
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AXIO',
      sessionDate: '2026-11-18',
      price: '46.00',
      intent: 'Initial',
    });
    const rev18 = await h.dailyReview.open('2026-11-18');
    const save18 = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioId,
      reviewDate: '2026-11-18',
      action: 'Hold',
      reason: 'Day 1 breach hold',
      expectedSnapshot: rev18.expectedSnapshot,
    });
    expect(save18.status).toBe('Saved');

    // Day 2 (Nov 19): Past Stop ($45.00) -> Hold -> MUST update the SAME StopDiscipline episode (zero duplicate!)
    h.clock.setIso('2026-11-19T22:00:00.000Z');
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AXIO',
      sessionDate: '2026-11-19',
      price: '45.00',
      intent: 'Initial',
    });
    const rev19 = await h.dailyReview.open('2026-11-19');
    const save19 = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioId,
      reviewDate: '2026-11-19',
      action: 'Hold',
      reason: 'Day 2 breach hold',
      expectedSnapshot: rev19.expectedSnapshot,
    });
    expect(save19.status).toBe('Saved');

    const devsAfterHold = await h.persistence.runReadTransaction(['deviations'], (tx) =>
      tx.getAllByIndex('deviations', 'by_trade', axioId),
    );
    const activeStopDevs = devsAfterHold.filter((d) => d.kind === 'StopDiscipline' && !d.voided);
    expect(activeStopDevs).toHaveLength(1);
    expect(activeStopDevs[0]?.sessionCount).toBe(2);
    expect(activeStopDevs[0]?.maxOverrunDisplay).toBe('-$200.00');

    // Day 3 (Nov 20): Exit while at Stop after holding past it -> OV-02 requires reason; with reason succeeds
    h.clock.setIso('2026-11-20T22:00:00.000Z');
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AXIO',
      sessionDate: '2026-11-20',
      price: '45.50',
      intent: 'Initial',
    });
    const rev20 = await h.dailyReview.open('2026-11-20');
    const axio20 = rev20.trades.find((t) => t.tradeId === axioId)!;
    expect(axio20.planCheck.exitFollowsPlan).toBe(false);

    const exitNoReason = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioId,
      reviewDate: '2026-11-20',
      action: 'Exit',
      expectedSnapshot: rev20.expectedSnapshot,
    });
    expect(exitNoReason.status).toBe('Rejected');

    const exitSaved = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioId,
      reviewDate: '2026-11-20',
      action: 'Exit',
      reason: 'Cutting the loser tomorrow.',
      expectedSnapshot: rev20.expectedSnapshot,
    });
    expect(exitSaved.status).toBe('Saved');

    // Day 4 (Nov 23): Still holding without sale -> staleExit ranks #1 with strict=true
    h.clock.setIso('2026-11-23T22:00:00.000Z');
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AXIO',
      sessionDate: '2026-11-23',
      price: '45.60',
      intent: 'Initial',
    });
    const rev23 = await h.dailyReview.open('2026-11-23');
    expect(rev23.trades[0]?.staleExit?.priorAction).toBe('Exit');
    expect(rev23.trades[0]?.strict).toBe(true);

    // Also verify fresh Target Exit with NO prior Hold past line requires zero reason (OV-02)
    const nvdaId = await h.openLongStock({
      symbol: 'NVDA',
      entry: '140.00',
      stop: '132.00',
      target: '164.00',
      economicTime: '2026-11-23T15:00:00.000Z',
      deferReflection: false,
    });
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-23',
      price: '165.00',
      intent: 'Initial',
    });
    const rev23WithNvda = await h.dailyReview.open('2026-11-23');
    const nvdaItem = rev23WithNvda.trades.find((t) => t.tradeId === nvdaId)!;
    expect(nvdaItem.planCheck.exitFollowsPlan).toBe(true);
    const nvdaExitOk = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: nvdaId,
      reviewDate: '2026-11-23',
      action: 'Exit',
      expectedSnapshot: rev23WithNvda.expectedSnapshot,
    });
    expect(nvdaExitOk.status).toBe('Saved');

    // Close AXIO on Nov 23 -> cutoff eligibility on Nov 20 still sees AXIO as Open! (AC-REV-001)
    const closeAxio = await h.workflows.recordPositionChange({
      tradeId: axioId,
      expectedFactRevision: 2,
      economicTime: '2026-11-23T16:00:00.000Z',
      executions: [
        { side: 'Sell', quantity: '100', fillPrice: '45.60', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      closeReasonId: 'cr_stop_triggered',
      reflection: { kind: 'Defer' },
    });
    expect(closeAxio.status).toBe('Recorded');

    const historicalRev20 = await h.dailyReview.open('2026-11-20');
    expect(historicalRev20.trades.some((t) => t.tradeId === axioId)).toBe(true);
  });

  it('keeps staleExit active across Change/re-save while open and skips malformed legacy action entries during StopDiscipline replay', async () => {
    const h = await createD5Harness();
    h.clock.setIso('2026-11-24T22:00:00.000Z');
    const nvdaId = await h.openLongStock({
      symbol: 'NVDA',
      entry: '140.00',
      stop: '132.00',
      target: '164.00',
      economicTime: '2026-11-19T15:00:00.000Z',
    });
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-19',
      price: '165.00',
      intent: 'Initial',
    });
    const r19 = await h.dailyReview.open('2026-11-19');
    const saveExit19 = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: nvdaId,
      reviewDate: '2026-11-19',
      action: 'Exit',
      reason: 'Booked target',
      expectedSnapshot: r19.expectedSnapshot,
    });
    expect(saveExit19.status).toBe('Saved');

    // Advance to Nov 20 (At Target again, still Open after Exit prior day): save Exit with reason, then inspect staleExit on reload & attempt Change without reason
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-20',
      price: '166.00',
      intent: 'Initial',
    });
    const r20Before = await h.dailyReview.open('2026-11-20');
    expect(r20Before.trades.find((t) => t.tradeId === nvdaId)?.staleExit).not.toBeNull();

    const save20 = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: nvdaId,
      reviewDate: '2026-11-20',
      action: 'Exit',
      reason: 'Order still pending',
      expectedSnapshot: r20Before.expectedSnapshot,
    });
    expect(save20.status).toBe('Saved');

    const r20After = await h.dailyReview.open('2026-11-20');
    // Server validation requires reason on staleExit Change -> UI open() must also keep staleExit non-null so UI agrees!
    expect(r20After.trades.find((t) => t.tradeId === nvdaId)?.staleExit).not.toBeNull();

    // Inject malformed legacy Review entry without action below Stop -> saving another date's Action must NOT coerce it to Hold
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-23',
      price: '128.00',
      intent: 'Initial',
    });
    await h.persistence.runWriteTransaction(['journal_entries'], (tx) => {
      tx.put('journal_entries', {
        id: 'jrn_legacy_bad',
        entryTypeId: DAILY_TRADE_REVIEW_TYPE_ID,
        definitionId: 'def_daily_trade_review_v1',
        definitionRevision: 1,
        definitionSnapshot: {} as never,
        source: 'DailyReview',
        anchor: { kind: 'Trade', tradeId: nvdaId },
        tradeId: nvdaId,
        origin: { kind: 'DailyReview', reviewDate: '2026-11-23' },
        obligationKey: `daily_review:${nvdaId}:2026-11-23`,
        responses: {},
        recordedAt: '2026-11-23T22:00:00.000Z',
      });
    });

    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-24',
      price: '150.00',
      intent: 'Initial',
    });
    const r24 = await h.dailyReview.open('2026-11-24');
    const save24 = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: nvdaId,
      reviewDate: '2026-11-24',
      action: 'Hold',
      reason: 'Confirming valid save with prior Exit intact',
      expectedSnapshot: r24.expectedSnapshot,
    });
    expect(save24.status).toBe('Saved');

    const devs = await h.persistence.runReadTransaction(['deviations'], (tx) =>
      tx.getAllByIndex('deviations', 'by_trade', nvdaId),
    );
    expect(devs.filter((d) => !d.voided)).toHaveLength(0);
  });

  it('rejects missing Mark, invalid conviction, and detects factRevision/actionEntry/debt snapshot conflicts', async () => {
    const h = await createD5Harness();

    // AXIO opened with deferred reflection -> creates 1 Outstanding Review Debt
    const axioId = await h.openLongStock({
      symbol: 'AXIO',
      entry: '50.00',
      stop: '47.00',
      target: '56.00',
      economicTime: '2026-11-18T15:00:00.000Z',
      deferReflection: true,
    });

    h.clock.setIso('2026-11-19T22:00:00.000Z');
    const revBeforeMark = await h.dailyReview.open('2026-11-19');

    // 1. SaveTradeAction without today Mark -> Rejected
    const noMark = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioId,
      reviewDate: '2026-11-19',
      action: 'Hold',
      expectedSnapshot: revBeforeMark.expectedSnapshot,
    });
    expect(noMark).toMatchObject({
      status: 'Rejected',
      message: expect.stringMatching(/Enter today's Mark/),
    });

    // Save mark for 2026-11-19
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AXIO',
      sessionDate: '2026-11-19',
      price: '51.50',
      intent: 'Initial',
    });
    const rev1 = await h.dailyReview.open('2026-11-19');
    const rev2 = await h.dailyReview.open('2026-11-19');
    expect(rev1.dueDebt).toHaveLength(1);
    const debtId = rev1.dueDebt[0]!.debt.id;

    // 2. Invalid conviction bounds (0, 6, 2.5) -> Rejected
    for (const badConviction of [0, 6, 2.5]) {
      const badConvRes = await h.dailyReview.save({
        kind: 'SaveTradeAction',
        tradeId: axioId,
        reviewDate: '2026-11-19',
        action: 'Hold',
        conviction: badConviction,
        expectedSnapshot: rev1.expectedSnapshot,
      });
      expect(badConvRes).toMatchObject({
        status: 'Rejected',
        message: expect.stringMatching(/Conviction must be an integer/),
      });
    }

    // 3. ResolveReviewDebt snapshot mismatch -> ReviewChanged, then double-resolve race -> Conflict
    const missingDebtInSnap = await h.dailyReview.save({
      kind: 'ResolveReviewDebt',
      debtId,
      reviewDate: '2026-11-19',
      mode: 'Decline',
      declineReason: 'Stale snapshot check',
      expectedSnapshot: { ...rev1.expectedSnapshot, outstandingDebtIds: [] },
    });
    expect(missingDebtInSnap).toMatchObject({
      status: 'ReviewChanged',
      reason: expect.stringMatching(/Due reflections changed/),
    });

    const resolve1 = await h.dailyReview.save({
      kind: 'ResolveReviewDebt',
      debtId,
      reviewDate: '2026-11-19',
      mode: 'Complete',
      decisionMode: 'As Planned',
      primaryEmotion: 'Calm',
      confidence: 4,
      expectedSnapshot: rev1.expectedSnapshot,
    });
    expect(resolve1.status).toBe('Saved');

    const staleDebt = await h.dailyReview.save({
      kind: 'ResolveReviewDebt',
      debtId,
      reviewDate: '2026-11-19',
      mode: 'Decline',
      declineReason: 'Duplicate attempt',
      expectedSnapshot: rev2.expectedSnapshot,
    });
    expect(staleDebt).toMatchObject({
      status: 'Conflict',
      reason: expect.stringMatching(/already been resolved/),
    });

    // 4. actionEntryIds conflict: first SaveTradeAction succeeds, second with pre-action snapshot returns ReviewChanged
    const revAfterDebt1 = await h.dailyReview.open('2026-11-19');
    const revAfterDebt2 = await h.dailyReview.open('2026-11-19');
    const actionSave1 = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioId,
      reviewDate: '2026-11-19',
      action: 'Hold',
      expectedSnapshot: revAfterDebt1.expectedSnapshot,
    });
    expect(actionSave1.status).toBe('Saved');

    const staleActionEntry = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioId,
      reviewDate: '2026-11-19',
      action: 'Exit',
      reason: 'Stale tab overwrite',
      expectedSnapshot: revAfterDebt2.expectedSnapshot,
    });
    expect(staleActionEntry).toMatchObject({
      status: 'ReviewChanged',
      reason: expect.stringMatching(/Another Review decision/),
    });

    // 5. tradeFactRevisions conflict: partial sell advances factRevision; saving with snapshot from before sell -> ReviewChanged
    const revBeforeSell = await h.dailyReview.open('2026-11-19');
    const partialSell = await h.workflows.recordPositionChange({
      tradeId: axioId,
      expectedFactRevision: revBeforeSell.expectedSnapshot.tradeFactRevisions[axioId]!,
      economicTime: '2026-11-19T16:00:00.000Z',
      executions: [
        {
          side: 'Sell',
          quantity: '25',
          fillPrice: '51.50',
          fee: '0.00',
          plannedLegIntent: 'PlannedLeg',
        },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(partialSell.status).toBe('Recorded');

    const staleFactSave = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioId,
      reviewDate: '2026-11-19',
      action: 'Exit',
      reason: 'Snapshot predates partial fill',
      expectedSnapshot: revBeforeSell.expectedSnapshot,
    });
    expect(staleFactSave).toMatchObject({
      status: 'ReviewChanged',
      reason: expect.stringMatching(/Trade facts changed/),
    });
  });

  it('blocks DailyReview.save with RuntimeNotWritable on a real seeded store and writes nothing', async () => {
    const { IDBFactory: LocalIDBFactory } = await import('fake-indexeddb');
    const { createPersistenceSeam: createLocalPersistence, CURRENT_SCHEMA_VERSION } = await import(
      '../../src/persistence/idb'
    );
    const { createDailyReview: createLocalDailyReview } = await import('../../src/daily-review/daily-review');
    const { createMarketData: createLocalMarketData } = await import('../../src/market-data/market-data');
    const { createReferenceCatalog: createLocalCatalog } = await import(
      '../../src/catalog/reference-catalog'
    );
    const { createJournal: createLocalJournal, PLAN_REFLECTION_TYPE_ID } = await import(
      '../../src/journal/journal'
    );
    const { createTradeWorkflows: createLocalWorkflows } = await import(
      '../../src/trade-workflows/trade-workflows'
    );
    const { createManualClock: createLocalClock } = await import('../../src/shared/clock');

    let writable = true;
    const clock = createLocalClock('2026-11-18T15:00:00.000Z');
    const persistence = createLocalPersistence({
      indexedDB: new LocalIDBFactory(),
      writeGate: {
        checkWritable: () =>
          writable
            ? { writable: true }
            : {
                writable: false,
                reason: 'RecoveryOnly',
                failedChecks: ['storage_diagnostic'],
              },
      },
    });
    await persistence.runWriteTransaction(['workspace_meta'], async (tx) => {
      tx.put('workspace_meta', {
        key: 'singleton',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        timeZone: 'America/New_York',
        settingsRevision: 1,
        workspaceRevision: 1,
        initializedAt: clock.nowIso(),
        updatedAt: clock.nowIso(),
      });
    });

    const catalog = createLocalCatalog({ persistence, clock });
    const journal = createLocalJournal({ persistence, clock });
    const workflows = createLocalWorkflows({ persistence, clock });
    const marketData = createLocalMarketData({ persistence, clock });
    const dailyReview = createLocalDailyReview({ persistence, clock });

    await catalog.seedDefaults();
    await journal.seedDefaults();
    const inst = await catalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
    if (inst.status !== 'Saved' || inst.family !== 'Institution') throw new Error('inst failed');
    const acct = await catalog.save({
      kind: 'CreateAccount',
      institutionId: inst.record.id,
      label: 'Margin',
    });
    if (acct.status !== 'Saved' || acct.family !== 'Account') throw new Error('acct failed');
    const strats = await catalog.query({ family: 'Strategy', includeInactive: false });
    if (strats.family !== 'Strategy' || !strats.items[0]) throw new Error('strat missing');
    const defs = await journal.getDefinitions();
    const planDef = defs.definitions.find((d) => d.entryTypeId === PLAN_REFLECTION_TYPE_ID)!;

    const conf = await workflows.confirmPlan({
      accountId: acct.record.id,
      strategyId: strats.items[0].id,
      symbol: 'AXIO',
      quantity: '100',
      intendedEntryPrice: '50.00',
      stopPrice: '47.00',
      targetPrice: '56.00',
      economicTime: '2026-11-18T15:00:00.000Z',
      planReflection: {
        definitionId: planDef.id,
        definitionRevision: planDef.revision,
        thesis: 'Breakout',
        invalidation: 'Below 47',
      },
    });
    if (conf.status !== 'Confirmed') throw new Error('confirm failed');

    const entry = await workflows.recordPositionChange({
      tradeId: conf.postCommit.trade.id,
      expectedFactRevision: 1,
      economicTime: '2026-11-18T15:00:00.000Z',
      executions: [
        { side: 'Buy', quantity: '100', fillPrice: '50.00', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(entry.status).toBe('Recorded');

    clock.setIso('2026-11-19T22:00:00.000Z');
    await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AXIO',
      sessionDate: '2026-11-19',
      price: '51.50',
      intent: 'Initial',
    });

    const revBeforeBlock = await dailyReview.open('2026-11-19');
    expect(revBeforeBlock.trades[0]?.todayAction).toBeNull();

    writable = false;
    const blocked = await dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: conf.postCommit.trade.id,
      reviewDate: '2026-11-19',
      action: 'Hold',
      expectedSnapshot: revBeforeBlock.expectedSnapshot,
    });
    expect(blocked.status).toBe('RuntimeNotWritable');

    writable = true;
    const revAfterBlock = await dailyReview.open('2026-11-19');
    expect(revAfterBlock.trades[0]?.todayAction).toBeNull();
    expect(revAfterBlock.expectedSnapshot).toEqual(revBeforeBlock.expectedSnapshot);
  });

  it('shares one symbol Mark row across two Open Trades of the same symbol while keeping independent Standing and Actions', async () => {
    const h = await createD5Harness();

    // Trade A: AXIO with stop $48.00 (will NOT be breached at $49.00 mark)
    const axioSafeId = await h.openLongStock({
      symbol: 'AXIO',
      entry: '50.00',
      stop: '48.00',
      target: '56.00',
      economicTime: '2026-11-18T15:00:00.000Z',
      deferReflection: false,
    });

    // Trade B: AXIO with tighter stop $49.50 (WILL be PastStop at $49.00 mark)
    const axioBreachId = await h.openLongStock({
      symbol: 'AXIO',
      entry: '51.00',
      stop: '49.50',
      target: '58.00',
      economicTime: '2026-11-18T16:00:00.000Z',
      deferReflection: false,
    });

    h.clock.setIso('2026-11-19T22:00:00.000Z');
    await h.marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AXIO',
      sessionDate: '2026-11-19',
      price: '49.00',
      intent: 'Initial',
    });

    const rev = await h.dailyReview.open('2026-11-19');
    expect(rev.marks).toHaveLength(1);
    expect(rev.marks[0]?.symbol).toBe('AXIO');
    expect(rev.marks[0]?.openTradeCount).toBe(2);

    const safeTrade = rev.trades.find((t) => t.tradeId === axioSafeId);
    const breachTrade = rev.trades.find((t) => t.tradeId === axioBreachId);
    expect(safeTrade?.standing.kind).toBe('Inside');
    expect(breachTrade?.standing.kind).toBe('PastStop');

    // Save Hold without reason succeeds for Inside trade, rejects for PastStop trade, then Exit saves cleanly
    const holdSafe = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioSafeId,
      reviewDate: '2026-11-19',
      action: 'Hold',
      expectedSnapshot: rev.expectedSnapshot,
    });
    expect(holdSafe.status).toBe('Saved');

    const rev2 = await h.dailyReview.open('2026-11-19');
    const holdBreachNoReason = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioBreachId,
      reviewDate: '2026-11-19',
      action: 'Hold',
      expectedSnapshot: rev2.expectedSnapshot,
    });
    expect(holdBreachNoReason).toMatchObject({
      status: 'Rejected',
      message: expect.stringMatching(/holding past your Plan line/i),
    });

    const exitBreach = await h.dailyReview.save({
      kind: 'SaveTradeAction',
      tradeId: axioBreachId,
      reviewDate: '2026-11-19',
      action: 'Exit',
      expectedSnapshot: rev2.expectedSnapshot,
    });
    expect(exitBreach.status).toBe('Saved');

    const rev3 = await h.dailyReview.open('2026-11-19');
    expect(rev3.completionState).toBe('Complete');
    expect(rev3.trades.find((t) => t.tradeId === axioSafeId)?.todayAction?.action).toBe('Hold');
    expect(rev3.trades.find((t) => t.tradeId === axioBreachId)?.todayAction?.action).toBe('Exit');
  });
});
