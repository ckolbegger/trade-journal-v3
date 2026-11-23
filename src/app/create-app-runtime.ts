import { createReferenceCatalog, type ReferenceCatalog } from '../catalog/reference-catalog';
import { createDailyReview, type DailyReview } from '../daily-review/daily-review';
import { createJournal, type Journal } from '../journal/journal';
import { createMarketData, type MarketData } from '../market-data/market-data';
import { createPersistenceSeam, type PersistenceSeam } from '../persistence/idb';
import {
  createRuntimeReadinessController,
  type RuntimeReadinessController,
} from '../runtime/readiness';
import {
  createBrowserReadinessProbes,
  registerAppServiceWorker,
  requestBrowserPersistentStorage,
  type SwUpdateHandle,
} from '../runtime/sw-client';
import { systemClock, type Clock } from '../shared/clock';
import { createTradeRecord, type TradeRecord } from '../trade-record/trade-record';
import { createTradeViews, type TradeViewsAndReporting } from '../trade-views/trade-views';
import { createTradeWorkflows, type TradeWorkflows } from '../trade-workflows/trade-workflows';
import { createWorkspace, type Workspace } from '../workspace/workspace';

export interface AppRuntime {
  readonly persistence: PersistenceSeam;
  readonly readiness: RuntimeReadinessController;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
  readonly marketData: MarketData;
  readonly dailyReview: DailyReview;
  readonly tradeRecord: TradeRecord;
  readonly workflows: TradeWorkflows;
  readonly views: TradeViewsAndReporting;
  readonly workspace: Workspace;
  readonly clock: Clock;
  registerServiceWorker(onUpdateAvailable: (handle: SwUpdateHandle) => void): Promise<void>;
}

export function createBrowserAppRuntime(): AppRuntime {
  const gateHolder: { checkWritable: RuntimeReadinessController['checkWritable'] } = {
    checkWritable: () => ({
      writable: false,
      reason: 'Unsupported',
      failedChecks: ['storage_diagnostic'],
    }),
  };

  const persistence = createPersistenceSeam({
    indexedDB: typeof window !== 'undefined' ? window.indexedDB : null,
    writeGate: { checkWritable: () => gateHolder.checkWritable() },
  });

  const probes = createBrowserReadinessProbes(persistence);
  const readiness = createRuntimeReadinessController({
    clock: systemClock,
    probes,
  });
  gateHolder.checkWritable = () => readiness.checkWritable();

  const catalog = createReferenceCatalog({ persistence, clock: systemClock });
  const journal = createJournal({ persistence, clock: systemClock });
  const marketData = createMarketData({ persistence, clock: systemClock });
  const dailyReview = createDailyReview({ persistence, clock: systemClock });
  const tradeRecord = createTradeRecord({ persistence });
  const workflows = createTradeWorkflows({ persistence, clock: systemClock });
  const views = createTradeViews({ persistence, clock: systemClock });

  const workspace = createWorkspace({
    persistence,
    readiness,
    catalog,
    journal,
    clock: systemClock,
    requestPersistentStorage: requestBrowserPersistentStorage,
  });

  return {
    persistence,
    readiness,
    catalog,
    journal,
    marketData,
    dailyReview,
    tradeRecord,
    workflows,
    views,
    workspace,
    clock: systemClock,
    async registerServiceWorker(onUpdateAvailable) {
      await registerAppServiceWorker({ onUpdateAvailable });
    },
  };
}
