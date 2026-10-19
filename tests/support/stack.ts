// The application stack wired as the composition root wires it, on fake-indexeddb and
// NodeTestHost, for coordinator tests.
import { IDBFactory } from 'fake-indexeddb';
import { createReadinessSession, evaluateReadiness, type ReadinessSession } from '../../src/delivery/readiness.ts';
import { toRuntimeNotWritable } from '../../src/delivery/write-gate.ts';
import { fixedClock } from '../../src/domain/time/index.ts';
import { createJournal } from '../../src/modules/journal/index.ts';
import { createReferenceCatalog } from '../../src/modules/reference-catalog/index.ts';
import { createTradeRecord } from '../../src/modules/trade-record/index.ts';
import { createPersistence } from '../../src/persistence/index.ts';
import { nodeTestHost } from './node-test-host.ts';
import { sequentialIds } from './workspace.ts';

const GB = 1024 ** 3;
export const TEST_CAPACITY = { projectedWorkspaceBytes: 0.7 * GB, requiredQuotaBytes: 2.1 * GB };

export async function testStack(factory = new IDBFactory(), now = '2026-10-12T14:05:00Z') {
  const testHost = await nodeTestHost(factory);
  const ids = sequentialIds('id');
  const clock = fixedClock(now);
  // The session and the persistence write gate refer to each other, as in the composition root.
  const holder: { session?: ReadinessSession } = {};
  const persistence = createPersistence({
    indexedDB: factory,
    ids,
    writeGate: {
      current: () => toRuntimeNotWritable(holder.session!.current()),
      recheck: async () => toRuntimeNotWritable(await holder.session!.recheck()),
    },
  });
  const session = await createReadinessSession(async () =>
    evaluateReadiness({
      host: testHost.host,
      rootInspection: await persistence.inspectRoot(),
      capacityRequirement: TEST_CAPACITY,
      pageReleaseId: testHost.releaseId,
    }),
  );
  holder.session = session;
  return {
    factory,
    testHost,
    session,
    persistence,
    ids,
    clock,
    catalog: createReferenceCatalog({ persistence, ids }),
    journal: createJournal({ persistence, ids, clock }),
    tradeRecord: createTradeRecord({ persistence, ids }),
  };
}

// Every database, store, and record, read with the raw API: the "unchanged" proof.
export async function dumpAll(factory: IDBFactory): Promise<Record<string, Record<string, unknown[]>>> {
  const out: Record<string, Record<string, unknown[]>> = {};
  for (const { name } of await factory.databases()) {
    if (!name) continue;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = factory.open(name);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('open failed'));
    });
    out[name] = {};
    for (const store of Array.from(db.objectStoreNames)) {
      out[name][store] = await new Promise((resolve) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
      });
    }
    db.close();
  }
  return out;
}
