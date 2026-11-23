import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createReferenceCatalog } from '../../src/catalog/reference-catalog';
import { createJournal, PLAN_REFLECTION_TYPE_ID } from '../../src/journal/journal';
import { createPersistenceSeam } from '../../src/persistence/idb';
import { createRuntimeReadinessController } from '../../src/runtime/readiness';
import { createManualClock } from '../../src/shared/clock';
import { createTradeRecord } from '../../src/trade-record/trade-record';
import { createTradeViews } from '../../src/trade-views/trade-views';
import { createTradeWorkflows } from '../../src/trade-workflows/trade-workflows';
import { createWorkspace } from '../../src/workspace/workspace';

async function setupD2Harness() {
  const idb = new IDBFactory();
  const clock = createManualClock('2026-11-23T14:30:00.000Z');
  const gateHolder: {
    checkWritable: ReturnType<typeof createRuntimeReadinessController>['checkWritable'];
  } = {
    checkWritable: () => ({
      writable: false,
      reason: 'Unsupported',
      failedChecks: ['storage_diagnostic'],
    }),
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
      checkServiceWorkerControl: async () => ({ controlled: true, releaseId: 'rel-d2' }),
      verifyOfflineInventory: async () => ({ valid: true, releaseId: 'rel-d2', assetCount: 6 }),
      checkStorageProtection: async () => ({ state: 'Protected' }),
    },
  });
  gateHolder.checkWritable = () => readiness.checkWritable();

  const catalog = createReferenceCatalog({ persistence, clock });
  const journal = createJournal({ persistence, clock });
  const tradeRecord = createTradeRecord({ persistence });
  const workspace = createWorkspace({
    persistence,
    readiness,
    catalog,
    journal,
    clock,
    requestPersistentStorage: async () => ({ state: 'Protected' }),
  });
  const workflows = createTradeWorkflows({ persistence, clock });
  const views = createTradeViews({ persistence });

  await workspace.initialize({ proposedTimeZone: 'America/New_York' });
  const inst = await catalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
  if (inst.status !== 'Saved' || inst.family !== 'Institution') throw new Error('inst failed');
  const acct = await catalog.save({
    kind: 'CreateAccount',
    institutionId: inst.record.id,
    label: 'Taxable Margin',
  });
  if (acct.status !== 'Saved' || acct.family !== 'Account') throw new Error('acct failed');

  const strategies = await catalog.query({ family: 'Strategy', includeInactive: false });
  if (strategies.family !== 'Strategy') throw new Error('expected Strategy query');
  const longStock = strategies.items[0];
  if (!longStock) throw new Error('expected seeded Long Stock strategy');

  const defs = await journal.getDefinitions();
  const planReflectionDef = defs.definitions.find((d) => d.entryTypeId === PLAN_REFLECTION_TYPE_ID);
  if (!planReflectionDef) throw new Error('expected seeded Plan Reflection definition');

  return {
    accountId: acct.record.id,
    strategyId: longStock.id,
    planReflectionDef,
    workflows,
    tradeRecord,
    journal,
    views,
    catalog,
    readiness,
  };
}

describe('TradeWorkflows.confirmPlan & TradeViews (D2) seam', () => {
  it('atomically creates a Planned Long Stock Trade, frozen Plan fact, and Plan Reflection Entry with one-call post-commit state', async () => {
    const h = await setupD2Harness();

    const confirmed = await h.workflows.confirmPlan({
      accountId: h.accountId,
      strategyId: h.strategyId,
      symbol: 'NVDA',
      quantity: '50',
      intendedEntryPrice: '140.00',
      stopPrice: '132.00',
      targetPrice: '164.00',
      economicTime: '2026-11-23T14:30:00.000Z',
      planReflection: {
        definitionId: h.planReflectionDef.id,
        definitionRevision: h.planReflectionDef.revision,
        thesis: 'Breakout above 6-week base on institutional volume.',
        invalidation: 'Daily close below 132 breaks the higher-low structure.',
        conviction: 4,
        primaryEmotion: 'Calm',
      },
    });

    expect(confirmed.status).toBe('Confirmed');
    if (confirmed.status !== 'Confirmed') return;

    expect(confirmed.postCommit.trade.lifecycleState).toBe('Planned');
    expect(confirmed.postCommit.trade.symbol).toBe('NVDA');
    expect(confirmed.postCommit.planFact.baseline.originalPlannedRiskDisplay).toBe('$400.00');
    expect(confirmed.postCommit.planFact.baseline.plannedRewardToRiskDisplay).toBe('3.00R');
    expect(confirmed.postCommit.journalEntry.source).toBe('PlanConfirmation');

    // Verify durable browse & C. Cockpit detail read back identically
    const list = await h.views.browseTrades({ lifecycleState: 'Planned' });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.id).toBe(confirmed.postCommit.trade.id);

    const detail = await h.views.getTradeDetail(confirmed.postCommit.trade.id);
    expect(detail?.trade.symbol).toBe('NVDA');
    expect(detail?.journalEntries).toHaveLength(1);
    expect(detail?.journalEntries[0]?.responses.thesis).toContain('Breakout above 6-week base');
  });

  it('rejects incomplete Plan Reflection or incoherent Stop/Target with zero writes to Trade or Journal stores', async () => {
    const h = await setupD2Harness();

    const rejected = await h.workflows.confirmPlan({
      accountId: h.accountId,
      strategyId: h.strategyId,
      symbol: 'AAPL',
      quantity: '25',
      intendedEntryPrice: '200.00',
      stopPrice: '210.00', // incoherent
      targetPrice: '230.00',
      economicTime: '2026-11-23T14:30:00.000Z',
      planReflection: {
        definitionId: h.planReflectionDef.id,
        definitionRevision: h.planReflectionDef.revision,
        thesis: '',
        invalidation: 'Breaks support',
      },
    });

    expect(rejected.status).toBe('Rejected');

    const trades = await h.tradeRecord.queryRecords({ lifecycleState: 'Planned' });
    const entries = await h.journal.query({});
    expect(trades.items).toEqual([]);
    expect(entries.items).toEqual([]);
  });

  it('rejects confirmPlan for archived Account/Institution, missing catalog IDs, and RuntimeNotWritable with zero writes', async () => {
    const h = await setupD2Harness();

    const baseInput = {
      strategyId: h.strategyId,
      symbol: 'AAPL',
      quantity: '25',
      intendedEntryPrice: '200.00',
      stopPrice: '190.00',
      targetPrice: '230.00',
      economicTime: '2026-11-23T14:30:00.000Z',
      planReflection: {
        definitionId: h.planReflectionDef.id,
        definitionRevision: h.planReflectionDef.revision,
        thesis: 'Higher low breakout',
        invalidation: 'Close below 190',
      },
    };

    const missingAcct = await h.workflows.confirmPlan({ ...baseInput, accountId: 'acct_missing' });
    expect(missingAcct.status).toBe('Rejected');
    if (missingAcct.status === 'Rejected') {
      expect(missingAcct.errors.map((e) => `${e.field}:${e.message}`).join(' ')).toMatch(/account/i);
    }

    const missingStrat = await h.workflows.confirmPlan({
      ...baseInput,
      accountId: h.accountId,
      strategyId: 'strat_missing',
    });
    expect(missingStrat.status).toBe('Rejected');
    if (missingStrat.status === 'Rejected') {
      expect(missingStrat.errors.map((e) => `${e.field}:${e.message}`).join(' ')).toMatch(/strategy/i);
    }

    // Archive Account -> confirmPlan rejects it
    const acctRes = await h.catalog.query({ family: 'Account', includeInactive: true });
    if (acctRes.family !== 'Account' || !acctRes.items[0]) throw new Error('expected account');
    const archivedAcctSave = await h.catalog.save({
      kind: 'ArchiveAccount',
      id: h.accountId,
      expectedRevision: acctRes.items[0].revision,
    });
    expect(archivedAcctSave.status).toBe('Saved');
    const archivedAcct = await h.workflows.confirmPlan({ ...baseInput, accountId: h.accountId });
    expect(archivedAcct.status).toBe('Rejected');
    if (archivedAcct.status === 'Rejected') {
      expect(archivedAcct.errors.map((e) => `${e.field}:${e.message}`).join(' ')).toMatch(/account/i);
    }

    // Reactivate Account and fail readiness -> RuntimeNotWritable
    const acctAfterArch = await h.catalog.query({ family: 'Account', includeInactive: true });
    if (acctAfterArch.family !== 'Account' || !acctAfterArch.items[0]) throw new Error('expected account');
    const reactivatedAcctSave = await h.catalog.save({
      kind: 'ReactivateAccount',
      id: h.accountId,
      expectedRevision: acctAfterArch.items[0].revision,
    });
    expect(reactivatedAcctSave.status).toBe('Saved');
    h.readiness.invalidateWritable('service_worker_control', 'SW controller lost', true);
    const notWritable = await h.workflows.confirmPlan({ ...baseInput, accountId: h.accountId });
    expect(notWritable.status).toBe('RuntimeNotWritable');

    const trades = await h.tradeRecord.queryRecords({});
    expect(trades.items).toEqual([]);
    const entries = await h.journal.query({});
    expect(entries.items).toEqual([]);
  });

  it('rejects confirmPlan when Institution is Archived even with an Active Account and writes zero records', async () => {
    const { IDBFactory: LocalIDBFactory } = await import('fake-indexeddb');
    const { createPersistenceSeam: createLocalPersistence, CURRENT_SCHEMA_VERSION } = await import(
      '../../src/persistence/idb'
    );
    const { createManualClock: createLocalClock } = await import('../../src/shared/clock');
    const { createReferenceCatalog: createLocalCatalog } = await import(
      '../../src/catalog/reference-catalog'
    );
    const { createJournal: createLocalJournal, PLAN_REFLECTION_TYPE_ID } = await import(
      '../../src/journal/journal'
    );
    const { createTradeWorkflows: createLocalWorkflows } = await import(
      '../../src/trade-workflows/trade-workflows'
    );
    const { createTradeRecord: createLocalTradeRecord } = await import(
      '../../src/trade-record/trade-record'
    );

    const clock = createLocalClock('2026-11-23T14:30:00.000Z');
    const persistence = createLocalPersistence({
      indexedDB: new LocalIDBFactory(),
      writeGate: { checkWritable: () => ({ writable: true }) },
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
    const tradeRecord = createLocalTradeRecord({ persistence });

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

    // Directly archive the Institution in IDB while keeping the Account Active to isolate Institution guard
    const seedArchivedInst = await persistence.runWriteTransaction(['catalog_institutions'], async (tx) => {
      tx.put('catalog_institutions', { ...inst.record, status: 'Archived', revision: 2 });
    });
    expect(seedArchivedInst.status).toBe('Committed');

    const rejected = await workflows.confirmPlan({
      accountId: acct.record.id,
      strategyId: strats.items[0].id,
      symbol: 'AAPL',
      quantity: '100',
      intendedEntryPrice: '150.00',
      stopPrice: '145.00',
      targetPrice: '165.00',
      economicTime: '2026-11-23T14:30:00.000Z',
      planReflection: {
        definitionId: planDef.id,
        definitionRevision: planDef.revision,
        thesis: 'Test thesis',
        invalidation: 'Test invalidation',
      },
    });
    expect(rejected.status).toBe('Rejected');
    if (rejected.status === 'Rejected') {
      expect(rejected.errors).toEqual([
        expect.objectContaining({
          field: 'accountId',
          message: expect.stringMatching(/active Institution/i),
        }),
      ]);
    }
    expect((await tradeRecord.queryRecords({})).items).toEqual([]);
    expect((await journal.query({})).items).toEqual([]);
  });
});
