import { createReferenceCatalog, type ReferenceCatalog } from '../catalog/reference-catalog';
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
import { createWorkspace, type Workspace } from '../workspace/workspace';

export interface AppRuntime {
  readonly persistence: PersistenceSeam;
  readonly readiness: RuntimeReadinessController;
  readonly catalog: ReferenceCatalog;
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

  const catalog = createReferenceCatalog({
    persistence,
    clock: systemClock,
  });

  const workspace = createWorkspace({
    persistence,
    readiness,
    catalog,
    clock: systemClock,
    requestPersistentStorage: requestBrowserPersistentStorage,
  });

  return {
    persistence,
    readiness,
    catalog,
    workspace,
    clock: systemClock,
    async registerServiceWorker(onUpdateAvailable) {
      await registerAppServiceWorker({ onUpdateAvailable });
    },
  };
}
