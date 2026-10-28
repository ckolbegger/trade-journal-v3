import { IDBFactory } from 'fake-indexeddb';
import { createPersistence, type Persistence } from '../../src/persistence/index.ts';
import { TEST_SESSION_POLICY } from './session-policy.ts';

export function sequentialIds(prefix = 'id') {
  let n = 0;
  return { next: () => `${prefix}-${String(++n).padStart(4, '0')}` };
}

// A fresh Writable Workspace on fake-indexeddb, for module tests.
export async function emptyWorkspace(): Promise<{ persistence: Persistence; factory: IDBFactory }> {
  const factory = new IDBFactory();
  const persistence = createPersistence({
    indexedDB: factory,
    ids: sequentialIds('ws'),
    writeGate: { current: () => null, recheck: () => Promise.resolve(null) },
    sessionPolicy: TEST_SESSION_POLICY,
  });
  const created = await persistence.createWorkspace([]);
  if (created.kind !== 'Created') throw new Error('workspace not created');
  return { persistence, factory };
}
