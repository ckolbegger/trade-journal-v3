import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createReferenceCatalog } from '../../src/catalog/reference-catalog';
import { createJournal, PLAN_REFLECTION_TYPE_ID } from '../../src/journal/journal';
import { createMarketData } from '../../src/market-data/market-data';
import {
  BOOTSTRAP_DB_NAME,
  CURRENT_SCHEMA_VERSION,
  SCHEMA_VERSION_V3,
  WORKSPACE_DB_PREFIX,
  createPersistenceSeam,
} from '../../src/persistence/idb';
import { migrateWorkspaceV3ToV4 } from '../../src/persistence/migrations';
import { createRuntimeReadinessController } from '../../src/runtime/readiness';
import { createManualClock } from '../../src/shared/clock';
import { createTradeViews } from '../../src/trade-views/trade-views';
import { createTradeWorkflows } from '../../src/trade-workflows/trade-workflows';
import { createWorkspace } from '../../src/workspace/workspace';

describe('D4 Integration — v3->v4 migration, MarketData + TradeViews, OV-04 fallback, Price History', () => {
  it('migrates v3->v4 preserving Open Trades and supports Review Marks, live evaluation, OV-04 fallback, explicit-gap Price History, and symbol deduplication', async () => {
    const idb = new IDBFactory();
    const clock = createManualClock('2025-11-18T15:00:00.000Z');
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
        checkServiceWorkerControl: async () => ({ controlled: true, releaseId: 'rel-d4' }),
        verifyOfflineInventory: async () => ({ valid: true, releaseId: 'rel-d4', assetCount: 6 }),
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

    // 1. Initialize workspace, create Institution + Account + Open NVDA Trade on 2025-11-18
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

    const planRes = await workflows.confirmPlan({
      accountId: acct.record.id,
      strategyId: strats.items[0].id,
      symbol: 'NVDA',
      quantity: '100',
      intendedEntryPrice: '140.00',
      stopPrice: '132.00',
      targetPrice: '164.00',
      economicTime: '2025-11-18T15:00:00.000Z',
      planReflection: {
        definitionId: planDef.id,
        definitionRevision: planDef.revision,
        thesis: 'Breakout above 6-week base.',
        invalidation: 'Daily close below 132.',
      },
    });
    expect(planRes.status).toBe('Confirmed');
    if (planRes.status !== 'Confirmed') throw new Error('plan');
    const tradeId = planRes.postCommit.trade.id;

    const entryRes = await workflows.recordPositionChange({
      tradeId,
      expectedFactRevision: 1,
      economicTime: '2025-11-18T15:05:00.000Z',
      executions: [
        { quantity: '100', fillPrice: '140.00', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(entryRes.status).toBe('Recorded');

    // Confirm workspace initialized cleanly at v4
    const rootAfter = await persistence.inspectRoot();
    expect(rootAfter.status).toBe('Present');
    if (rootAfter.status === 'Present') {
      expect(rootAfter.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(rootAfter.schemaVersion).toBeGreaterThan(SCHEMA_VERSION_V3);
    }

    // 2. Advance clock to Thu 2025-11-20 17:00 ET (22:00 UTC) -> latest completed session = 2025-11-20
    clock.setIso('2025-11-20T22:00:00.000Z');
    const marketData = createMarketData({ persistence, clock });
    const views = createTradeViews({ persistence, clock });

    // Before any Marks: ReviewMarksView lists NVDA missing; TradeDetail has evaluation=Unavailable (no priorContext)
    const reviewBefore = await views.getReviewMarksView();
    expect(reviewBefore.sessionDate).toBe('2025-11-20');
    expect(reviewBefore.rows).toHaveLength(1);
    expect(reviewBefore.rows[0]?.symbol).toBe('NVDA');
    expect(reviewBefore.rows[0]?.todayMarkDisplay).toBeNull();
    expect(reviewBefore.rows[0]?.todayUnavailableAcknowledged).toBe(false);

    const detailBefore = await views.getTradeDetail(tradeId);
    expect(detailBefore?.evaluation?.availability).toBe('Unavailable');
    if (detailBefore?.evaluation?.availability === 'Unavailable') {
      expect(detailBefore.evaluation.priorContext).toBeNull();
    }
    expect(detailBefore?.priceHistory.map((r) => r.sessionDate)).toEqual([
      '2025-11-20',
      '2025-11-19',
      '2025-11-18',
    ]);
    expect(detailBefore?.priceHistory.every((r) => r.markDisplay === null)).toBe(true);

    // 3. Save Mark for 2025-11-18 ($144.00) -> OV-04 prior-session fallback when 2025-11-20 is missing
    const savePrior = await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2025-11-18',
      price: '144.00',
      intent: 'Initial',
    });
    expect(savePrior.status).toBe('Saved');

    const detailFallback = await views.getTradeDetail(tradeId);
    expect(detailFallback?.evaluation?.availability).toBe('Unavailable');
    if (detailFallback?.evaluation?.availability === 'Unavailable') {
      expect(detailFallback.evaluation.priorContext?.asOfSessionDate).toBe('2025-11-18');
      expect(detailFallback.evaluation.priorContext?.evaluation.openPnlDisplay).toBe('+$400.00');
      expect(detailFallback.evaluation.priorContext?.evaluation.openPnlRDisplay).toBe('+0.50R');
    }

    // 4. Save Mark for 2025-11-20 ($150.00) while leaving 2025-11-19 as an explicit gap
    const saveToday = await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2025-11-20',
      price: '150.00',
      intent: 'Initial',
    });
    expect(saveToday.status).toBe('Saved');

    const reviewAfter = await views.getReviewMarksView();
    expect(reviewAfter.rows[0]?.todayMarkDisplay).toBe('$150.00');

    const detailToday = await views.getTradeDetail(tradeId);
    expect(detailToday?.evaluation?.availability).toBe('Available');
    if (detailToday?.evaluation?.availability === 'Available') {
      expect(detailToday.evaluation.sessionDate).toBe('2025-11-20');
      expect(detailToday.evaluation.openPnlDisplay).toBe('+$1,000.00');
      expect(detailToday.evaluation.openPnlRDisplay).toBe('+1.25R');
    }
    // 2025-11-19 remains an explicit gap (markDisplay === null, never forward-filled)
    const nov19 = detailToday?.priceHistory.find((r) => r.sessionDate === '2025-11-19');
    expect(nov19?.markDisplay).toBeNull();
    expect(nov19?.tradePnlDisplay).toBeNull();

    // 5. browseTrades reflects live MTM P&L and Plan-R
    const browse = await views.browseTrades({ lifecycleState: 'Open' });
    expect(browse.items).toHaveLength(1);
    const itemEval = browse.items[0]?.evaluation;
    expect(itemEval?.availability).toBe('Available');
    if (itemEval?.availability === 'Available') {
      expect(itemEval.openPnlDisplay).toBe('+$1,000.00');
      expect(itemEval.openPnlRDisplay).toBe('+1.25R');
    }

    // 6. Create a second Open Trade on NVDA -> ReviewMarksView deduplicates to 1 symbol row covering 2 trades
    const plan2 = await workflows.confirmPlan({
      accountId: acct.record.id,
      strategyId: strats.items[0].id,
      symbol: 'NVDA',
      quantity: '50',
      intendedEntryPrice: '148.00',
      stopPrice: '140.00',
      targetPrice: '170.00',
      economicTime: '2025-11-20T15:00:00.000Z',
      planReflection: {
        definitionId: planDef.id,
        definitionRevision: planDef.revision,
        thesis: 'Second position',
        invalidation: 'Close below 140',
      },
    });
    expect(plan2.status).toBe('Confirmed');
    if (plan2.status === 'Confirmed') {
      await workflows.recordPositionChange({
        tradeId: plan2.postCommit.trade.id,
        expectedFactRevision: 1,
        economicTime: '2025-11-20T15:05:00.000Z',
        executions: [
          { quantity: '50', fillPrice: '148.00', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
        ],
        reflection: { kind: 'Defer' },
      });
    }
    const reviewDedup = await views.getReviewMarksView();
    expect(reviewDedup.rows).toHaveLength(1);
    expect(reviewDedup.rows[0]?.openTradeCount).toBe(2);
    expect(reviewDedup.openTrades).toHaveLength(2);

    // 7. Scale into trade 1 on 2025-11-20 (+100 shares @ $150.00):
    // Price History on 2025-11-18 must still reflect ONLY the 100 shares open on 11-18 (+$400.00), not 200 shares!
    const scaleIn = await workflows.recordPositionChange({
      tradeId,
      expectedFactRevision: 2,
      economicTime: '2025-11-20T15:30:00.000Z',
      executions: [
        { quantity: '100', fillPrice: '150.00', fee: '0.00', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(scaleIn.status).toBe('Recorded');

    const detailAfterScale = await views.getTradeDetail(tradeId);
    const nov18Row = detailAfterScale?.priceHistory.find((r) => r.sessionDate === '2025-11-18');
    const nov20Row = detailAfterScale?.priceHistory.find((r) => r.sessionDate === '2025-11-20');
    expect(nov18Row?.tradePnlDisplay).toBe('+$400.00');
    expect(nov20Row?.tradePnlDisplay).toBe('+$1,000.00');
  });

  it('migrates a genuine v3 database to v4 with rollback on injected failure and full data preservation on success', async () => {
    const idb = new IDBFactory();

    // Seed bootstrap pointer at generation 1, schemaVersion 3
    await new Promise<void>((resolve, reject) => {
      const req = idb.open(BOOTSTRAP_DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('pointer', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('pointer', 'readwrite');
        tx.objectStore('pointer').put({
          key: 'active',
          activeGeneration: 1,
          schemaVersion: SCHEMA_VERSION_V3,
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('pointer seed failed'));
      };
      req.onerror = () => reject(req.error ?? new Error('bootstrap open failed'));
    });

    // Seed genuine v3 workspace DB with all real v3 object stores + 1 Trade
    const v3Stores = [
      'workspace_meta',
      'catalog_meta',
      'catalog_institutions',
      'catalog_accounts',
      'catalog_strategies',
      'trades',
      'trade_facts',
      'position_changes',
      'executions',
      'deviations',
      'journal_meta',
      'journal_definitions',
      'journal_entries',
      'journal_debt',
      'journal_declines',
      'proj_trade_analysis_input',
    ];
    await new Promise<void>((resolve, reject) => {
      const req = idb.open(`${WORKSPACE_DB_PREFIX}1`, SCHEMA_VERSION_V3);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of v3Stores) {
          const keyPath =
            name.endsWith('_meta') ? 'key' : 'id';
          db.createObjectStore(name, { keyPath });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['workspace_meta', 'trades'], 'readwrite');
        tx.objectStore('workspace_meta').put({
          key: 'singleton',
          schemaVersion: SCHEMA_VERSION_V3,
          timeZone: 'America/New_York',
          settingsRevision: 1,
          workspaceRevision: 1,
          initializedAt: '2025-11-18T15:00:00.000Z',
          updatedAt: '2025-11-18T15:00:00.000Z',
        });
        tx.objectStore('trades').put({
          id: 'trd-v3-1',
          symbol: 'NVDA',
          lifecycleState: 'Open',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('v3 seed failed'));
      };
      req.onerror = () => reject(req.error ?? new Error('v3 open failed'));
    });

    // 1. Injected failure rolls back cleanly without touching active generation 1
    const failed = await migrateWorkspaceV3ToV4({
      indexedDB: idb,
      fromGeneration: 1,
      injectFailureStage: 'after_copy',
    });
    expect(failed.status).toBe('MigrationBlocked');

    const persistence = createPersistenceSeam({
      indexedDB: idb,
      writeGate: { checkWritable: () => ({ writable: true }) },
    });
    const rootStillV3 = await persistence.inspectRoot();
    expect(rootStillV3.status).toBe('Present');
    if (rootStillV3.status === 'Present') {
      expect(rootStillV3.activeGeneration).toBe(1);
      expect(rootStillV3.schemaVersion).toBe(SCHEMA_VERSION_V3);
    }

    // 2. Real v3 -> v4 migration succeeds and preserves the trade + adds market_* stores
    const ok = await migrateWorkspaceV3ToV4({
      indexedDB: idb,
      fromGeneration: 1,
    });
    expect(ok.status).toBe('Migrated');
    const rootV4 = await persistence.inspectRoot();
    expect(rootV4.status).toBe('Present');
    if (rootV4.status === 'Present') {
      expect(rootV4.activeGeneration).toBe(2);
      expect(rootV4.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    }

    const { preservedTrade, marks } = await persistence.runReadTransaction(
      ['trades', 'market_marks'],
      async (tx) => ({
        preservedTrade: await tx.get('trades', 'trd-v3-1'),
        marks: await tx.getAll('market_marks'),
      }),
    );
    expect(preservedTrade?.symbol).toBe('NVDA');
    expect(marks).toEqual([]);
  });
});
