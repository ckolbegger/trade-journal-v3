import { IDBFactory } from 'fake-indexeddb';
import { createReferenceCatalog, type ReferenceCatalog } from '../../src/catalog/reference-catalog';
import { createDailyReview, type DailyReview } from '../../src/daily-review/daily-review';
import {
  createJournal,
  PLAN_REFLECTION_TYPE_ID,
  POSITION_CHANGE_REFLECTION_TYPE_ID,
  type Journal,
} from '../../src/journal/journal';
import { createMarketData, type MarketData } from '../../src/market-data/market-data';
import { createPersistenceSeam, type PersistenceSeam } from '../../src/persistence/idb';
import { createRuntimeReadinessController } from '../../src/runtime/readiness';
import { createManualClock } from '../../src/shared/clock';
import type { WriteGateDecision } from '../../src/persistence/idb';
import { createTradeViews, type TradeViewsAndReporting } from '../../src/trade-views/trade-views';
import { createTradeWorkflows, type TradeWorkflows } from '../../src/trade-workflows/trade-workflows';
import { createWorkspace, type Workspace } from '../../src/workspace/workspace';

export interface TestJournalHarness {
  readonly idb: IDBFactory;
  readonly clock: ReturnType<typeof createManualClock>;
  readonly persistence: PersistenceSeam;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
  readonly workspace: Workspace;
  readonly workflows: TradeWorkflows;
  readonly marketData: MarketData;
  readonly dailyReview: DailyReview;
  readonly views: TradeViewsAndReporting;
  readonly accountId: string;
  readonly institutionId: string;
  readonly strategyId: string;
  readonly planDefId: string;
  readonly planDefRev: number;
  readonly pcDefId: string;
  readonly pcDefRev: number;
  readonly closeReasonIds: {
    readonly targetReached: string;
    readonly stopTriggered: string;
    readonly thesisInvalidated: string;
    readonly timeBasedExit: string;
  };
  setWritable(next: boolean): void;
  createPlannedLongStock(opts: {
    symbol: string;
    qty?: string;
    entry: string;
    stop: string;
    target: string;
    economicTime: string;
  }): Promise<string>;
  openLongStock(opts: {
    symbol: string;
    qty?: string;
    entry: string;
    stop: string;
    target: string;
    economicTime: string;
    fillPrice?: string;
    fee?: string;
    deferReflection?: boolean;
  }): Promise<{ tradeId: string; factRevision: number }>;
  closeLongStock(opts: {
    tradeId: string;
    expectedFactRevision: number;
    economicTime: string;
    qty?: string;
    fillPrice: string;
    fee?: string;
    closeReasonId?: string;
    deferReflection?: boolean;
  }): Promise<{ factRevision: number }>;
}

export async function createTestJournalHarness(
  initialIso = '2026-11-02T15:00:00.000Z',
): Promise<TestJournalHarness> {
  const idb = new IDBFactory();
  const clock = createManualClock(initialIso);
  let writable = true;
  const gateHolder: { checkWritable: () => WriteGateDecision } = {
    checkWritable: () =>
      writable
        ? { writable: true }
        : { writable: false, reason: 'RecoveryOnly', failedChecks: ['service_worker_control'] },
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
      checkServiceWorkerControl: async () => ({ controlled: true, releaseId: 'rel-test' }),
      verifyOfflineInventory: async () => ({ valid: true, releaseId: 'rel-test', assetCount: 6 }),
      checkStorageProtection: async () => ({ state: 'Protected' }),
    },
  });

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
  const views = createTradeViews({ persistence, clock });

  const initRes = await workspace.initialize({ proposedTimeZone: 'America/New_York' });
  if (initRes.status !== 'Opened') {
    throw new Error(`workspace.initialize failed: ${initRes.status}`);
  }

  const inst = await catalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
  if (inst.status !== 'Saved' || inst.family !== 'Institution') {
    throw new Error(`CreateInstitution failed: ${inst.status}`);
  }
  const acct = await catalog.save({
    kind: 'CreateAccount',
    institutionId: inst.record.id,
    label: 'Margin',
  });
  if (acct.status !== 'Saved' || acct.family !== 'Account') {
    throw new Error(`CreateAccount failed: ${acct.status}`);
  }
  const strats = await catalog.query({ family: 'Strategy', includeInactive: false });
  if (strats.family !== 'Strategy' || !strats.items[0]) {
    throw new Error(`Strategy query failed: ${strats.family}`);
  }
  const closeReasons = await catalog.query({ family: 'CloseReason', includeInactive: false });
  if (closeReasons.family !== 'CloseReason') {
    throw new Error(`CloseReason query failed: ${closeReasons.family}`);
  }

  const defs = await journal.getDefinitions();
  const foundPlanDef = defs.definitions.find((d) => d.entryTypeId === PLAN_REFLECTION_TYPE_ID);
  if (!foundPlanDef) {
    throw new Error(`Missing seeded definition: ${PLAN_REFLECTION_TYPE_ID}`);
  }
  const foundPcDef = defs.definitions.find(
    (d) => d.entryTypeId === POSITION_CHANGE_REFLECTION_TYPE_ID,
  );
  if (!foundPcDef) {
    throw new Error(`Missing seeded definition: ${POSITION_CHANGE_REFLECTION_TYPE_ID}`);
  }
  const planDef = foundPlanDef;
  const pcDef = foundPcDef;

  const findCr = (key: string) => {
    const found = closeReasons.items.find((c) => c.productKey === key);
    if (!found) {
      throw new Error(`Missing seeded CloseReason: ${key}`);
    }
    return found.id;
  };

  const accountId = acct.record.id;
  const institutionId = inst.record.id;
  const strategyId = strats.items[0].id;

  async function createPlannedLongStock(opts: {
    symbol: string;
    qty?: string;
    entry: string;
    stop: string;
    target: string;
    economicTime: string;
  }): Promise<string> {
    const plan = await workflows.confirmPlan({
      accountId,
      strategyId,
      symbol: opts.symbol,
      quantity: opts.qty ?? '100',
      intendedEntryPrice: opts.entry,
      stopPrice: opts.stop,
      targetPrice: opts.target,
      economicTime: opts.economicTime,
      planReflection: {
        definitionId: planDef.id,
        definitionRevision: planDef.revision,
        thesis: `${opts.symbol} breakout setup`,
        invalidation: `Close below ${opts.stop}`,
      },
    });
    if (plan.status !== 'Confirmed') {
      throw new Error(`confirmPlan failed: ${plan.status}`);
    }
    return plan.postCommit.trade.id;
  }

  async function openLongStock(opts: {
    symbol: string;
    qty?: string;
    entry: string;
    stop: string;
    target: string;
    economicTime: string;
    fillPrice?: string;
    fee?: string;
    deferReflection?: boolean;
  }): Promise<{ tradeId: string; factRevision: number }> {
    const tradeId = await createPlannedLongStock(opts);
    const fill = await workflows.recordPositionChange({
      tradeId,
      expectedFactRevision: 1,
      economicTime: opts.economicTime,
      executions: [
        {
          quantity: opts.qty ?? '100',
          fillPrice: opts.fillPrice ?? opts.entry,
          fee: opts.fee ?? '0.00',
          plannedLegIntent: 'PlannedLeg',
        },
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
    if (fill.status !== 'Recorded') {
      throw new Error(`recordPositionChange failed: ${fill.status}`);
    }
    return { tradeId, factRevision: fill.postCommit.trade.factRevision };
  }

  async function closeLongStock(opts: {
    tradeId: string;
    expectedFactRevision: number;
    economicTime: string;
    qty?: string;
    fillPrice: string;
    fee?: string;
    closeReasonId?: string;
    deferReflection?: boolean;
  }): Promise<{ factRevision: number }> {
    const res = await workflows.recordPositionChange({
      tradeId: opts.tradeId,
      expectedFactRevision: opts.expectedFactRevision,
      economicTime: opts.economicTime,
      executions: [
        {
          side: 'Sell',
          quantity: opts.qty ?? '100',
          fillPrice: opts.fillPrice,
          fee: opts.fee ?? '0.00',
          plannedLegIntent: 'PlannedLeg',
        },
      ],
      closeReasonId: opts.closeReasonId ?? findCr('target-reached'),
      reflection: opts.deferReflection
        ? { kind: 'Defer' }
        : {
            kind: 'Complete',
            definitionId: pcDef.id,
            definitionRevision: pcDef.revision,
            decisionMode: 'As Planned',
            primaryEmotion: 'Calm',
            decisionConfidence: 4,
            note: 'Clean exit.',
          },
    });
    if (res.status !== 'Recorded') {
      throw new Error(`closeLongStock failed: ${res.status}`);
    }
    return { factRevision: res.postCommit.trade.factRevision };
  }

  return {
    idb,
    clock,
    persistence,
    catalog,
    journal,
    workspace,
    workflows,
    marketData,
    dailyReview,
    views,
    accountId,
    institutionId,
    strategyId,
    planDefId: planDef.id,
    planDefRev: planDef.revision,
    pcDefId: pcDef.id,
    pcDefRev: pcDef.revision,
    closeReasonIds: {
      targetReached: findCr('target-reached'),
      stopTriggered: findCr('stop-triggered'),
      thesisInvalidated: findCr('thesis-invalidated'),
      timeBasedExit: findCr('time-based-exit'),
    },
    setWritable: (next: boolean) => {
      writable = next;
    },
    createPlannedLongStock,
    openLongStock,
    closeLongStock,
  };
}
