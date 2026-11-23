import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createReferenceCatalog } from '../../src/catalog/reference-catalog';
import {
  createJournal,
  PLAN_REFLECTION_TYPE_ID,
  POSITION_CHANGE_REFLECTION_TYPE_ID,
} from '../../src/journal/journal';
import { createPersistenceSeam } from '../../src/persistence/idb';
import { createRuntimeReadinessController } from '../../src/runtime/readiness';
import { createManualClock } from '../../src/shared/clock';
import { createTradeViews } from '../../src/trade-views/trade-views';
import { createTradeWorkflows } from '../../src/trade-workflows/trade-workflows';
import { createWorkspace } from '../../src/workspace/workspace';

async function setupD3Harness() {
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
      checkServiceWorkerControl: async () => ({ controlled: true, releaseId: 'rel-d3' }),
      verifyOfflineInventory: async () => ({ valid: true, releaseId: 'rel-d3', assetCount: 6 }),
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
  const views = createTradeViews({ persistence });

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

  const planRes = await workflows.confirmPlan({
    accountId: acct.record.id,
    strategyId: strats.items[0].id,
    symbol: 'NVDA',
    quantity: '100',
    intendedEntryPrice: '140.00',
    stopPrice: '132.00',
    targetPrice: '164.00',
    economicTime: '2026-11-23T14:30:00.000Z',
    planReflection: {
      definitionId: planDef.id,
      definitionRevision: planDef.revision,
      thesis: 'Breakout above base',
      invalidation: 'Close below 132',
    },
  });
  if (planRes.status !== 'Confirmed') throw new Error('plan');

  return {
    tradeId: planRes.postCommit.trade.id,
    pcDef,
    workflows,
    views,
    journal,
    persistence,
    clock,
  };
}

describe('TradeWorkflows.recordPositionChange (D3 Opening Execution) seam', () => {
  it('transitions Planned -> Open atomically, creates durable Journal Debt on Defer (never a blank Entry), and allows scale-ins without blocking', async () => {
    const h = await setupD3Harness();

    // First fill: 60 shares, Defer reflection
    const open1 = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 1,
      economicTime: '2026-11-23T14:35:00.000Z',
      executions: [
        { quantity: '60', fillPrice: '140.50', fee: '1.20', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });

    expect(open1.status).toBe('Recorded');
    if (open1.status !== 'Recorded') return;
    expect(open1.postCommit.trade.lifecycleState).toBe('Open');
    expect(open1.postCommit.trade.factRevision).toBe(2);
    expect(open1.postCommit.journalOutcome.kind).toBe('Debt');

    // Outstanding Debt must NOT block a second scale-in execution
    const open2 = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 2,
      economicTime: '2026-11-23T15:00:00.000Z',
      executions: [
        { quantity: '40', fillPrice: '139.25', fee: '0.80', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: {
        kind: 'Complete',
        definitionId: h.pcDef.id,
        definitionRevision: h.pcDef.revision,
        decisionMode: 'As Planned',
        primaryEmotion: 'Calm',
        decisionConfidence: 4,
        note: 'Filled remaining tranche on pullback.',
      },
    });

    expect(open2.status).toBe('Recorded');
    if (open2.status !== 'Recorded') return;
    expect(open2.postCommit.trade.lifecycleState).toBe('Open');
    expect(open2.postCommit.trade.factRevision).toBe(3);
    expect(open2.postCommit.journalOutcome.kind).toBe('Entry');

    // Verify TradeViews detail reflects Open Lots, Entry Quality, 1 Debt, and 2 Entries (Plan + PC2)
    const detail = await h.views.getTradeDetail(h.tradeId);
    expect(detail?.trade.lifecycleState).toBe('Open');
    expect(detail?.derived.openSharesDisplay).toBe('100');
    expect(detail?.derived.fulfillment).toBe('FilledAsPlanned');
    expect(detail?.journalDebt).toHaveLength(1);
    expect(detail?.journalEntries).toHaveLength(2);
  });

  it('rejects stale expectedFactRevision with Conflict and zero writes, and records explicit Decline distinctly', async () => {
    const h = await setupD3Harness();

    const conflict = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 99,
      economicTime: '2026-11-23T14:35:00.000Z',
      executions: [
        { quantity: '50', fillPrice: '140.00', fee: '0', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(conflict.status).toBe('Conflict');

    const declined = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 1,
      economicTime: '2026-11-23T14:35:00.000Z',
      executions: [
        { quantity: '50', fillPrice: '140.00', fee: '0', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Decline', reason: 'Routine limit fill' },
    });
    expect(declined.status).toBe('Recorded');
    if (declined.status !== 'Recorded') return;
    expect(declined.postCommit.journalOutcome.kind).toBe('Decline');

    const detail = await h.views.getTradeDetail(h.tradeId);
    expect(detail?.journalDeclines).toHaveLength(1);
    expect(detail?.journalDebt).toHaveLength(0);
  });

  it('rejects recordPositionChange with zero writes when stored lifecycle disagrees with existing execution facts (no auto-repair)', async () => {
    const h = await setupD3Harness();

    // Record a valid opening fill -> lifecycle becomes Open (factRevision 2)
    const opened = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 1,
      economicTime: '2026-11-23T14:35:00.000Z',
      executions: [
        { quantity: '50', fillPrice: '140.00', fee: '0', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(opened.status).toBe('Recorded');
    if (opened.status !== 'Recorded') return;

    // Corrupt stored lifecycleState back to Planned while executions remain
    await h.persistence.runWriteTransaction(['trades'], (tx) => {
      tx.put('trades', { ...opened.postCommit.trade, lifecycleState: 'Planned' });
    });

    const attempted = await h.workflows.recordPositionChange({
      tradeId: h.tradeId,
      expectedFactRevision: 2,
      economicTime: '2026-11-23T15:00:00.000Z',
      executions: [
        { quantity: '20', fillPrice: '141.00', fee: '0', plannedLegIntent: 'PlannedLeg' },
      ],
      reflection: { kind: 'Defer' },
    });
    expect(attempted.status).toBe('Rejected');
    if (attempted.status === 'Rejected') {
      expect(attempted.errors[0]?.message).toContain("Facts can't be replayed");
    }
  });
});
