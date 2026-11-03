// Bundled for the browser by stale-index.spec.ts (T6.25-B2). It drives the production Persistence and Trade Record
// write path on Chromium's own IndexedDB, churns Trades through Plan, entries and exit, and times the Open-range read
// of `trades.byLifecycleActivity` on that database and on a fresh one holding the same documents.
import { createPersistence, beginSemanticTransaction } from '../../src/persistence/index.ts';
import { createTradeRecord, type ExecutionFactValue } from '../../src/modules/trade-record/index.ts';

const BATCH = 100;
const KEEP_OPEN = 100;
const START = Date.parse('2026-01-02T14:00:00Z');
const instant = (minutes: number) => new Date(START + minutes * 60_000).toISOString().replace('.000Z', 'Z');

const execution = (action: 'Buy' | 'Sell', economicTime: string, quantity: string): ExecutionFactValue => ({
  economicTime,
  action,
  instrument: { kind: 'Stock', symbol: 'XYZ' },
  quantity,
  price: '20.00',
  fee: '1.00',
  intent: { kind: 'ServesPlannedLeg', plannedLegId: 'leg' },
});

const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error ?? new Error('request failed'));
});

// The median of repeated whole-range reads, each in its own read-only transaction.
async function medianOpenRead(db: IDBDatabase): Promise<number> {
  const range = IDBKeyRange.bound(['Open'], ['Open', []]);
  const times: number[] = [];
  for (let i = 0; i < 9; i++) {
    const t0 = performance.now();
    await request(db.transaction(['trades'], 'readonly').objectStore('trades').index('byLifecycleActivity').getAll(range));
    times.push(performance.now() - t0);
  }
  return times.sort((a, b) => a - b)[4]!;
}

async function openDatabase(name: string, upgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  const open = indexedDB.open(name, upgrade ? 1 : undefined);
  if (upgrade) open.onupgradeneeded = () => upgrade(open.result);
  return request(open);
}

async function run(count: number) {
  let n = 0;
  const ids = { next: () => `id-${String(++n).padStart(7, '0')}` };
  const persistence = createPersistence({
    indexedDB,
    ids,
    writeGate: { current: () => null, recheck: () => Promise.resolve(null) },
    sessionPolicy: { id: 'policy', revision: 1, digest: 'digest', coverage: { first: '2024-01-01', last: '2028-12-31' } },
  });
  const created = await persistence.createWorkspace([]);
  if (created.kind !== 'Created') throw new Error('workspace not created');
  const record = createTradeRecord({ persistence, ids });

  const commit = async (tx: ReturnType<typeof beginSemanticTransaction>) => {
    const result = await persistence.commit(tx.close());
    if (result.kind !== 'Committed') throw new Error(result.kind);
  };
  // Each phase writes its Trades in batches of one commit, through prepare, apply and commit.
  const phase = async (indices: readonly number[], step: (i: number, tx: ReturnType<typeof beginSemanticTransaction>) => Promise<void>) => {
    for (let from = 0; from < indices.length; from += BATCH) {
      const tx = beginSemanticTransaction();
      for (const i of indices.slice(from, from + BATCH)) await step(i, tx);
      await commit(tx);
    }
  };
  const all = Array.from({ length: count }, (_, i) => i);
  const tradeIds: string[] = [];

  await phase(all, async (i, tx) => {
    const prepared = await record.prepareChange({
      kind: 'ConfirmPlan',
      accountId: 'account-1',
      strategyId: 'strategy-1',
      plan: {
        economicTime: instant(i),
        underlying: 'XYZ',
        thesis: 'Breakout.',
        invalidation: 'Below 48.',
        legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '20' }],
        stops: [{ kind: 'UnderlyingPrice', price: '19' }],
        targets: [{ kind: 'UnderlyingPrice', price: '30' }],
      },
    });
    if (prepared.kind !== 'Prepared') throw new Error(prepared.kind);
    const staged = record.applyPreparedChange(tx, prepared, { candidateDigest: prepared.digest, expectedLifecycle: 'Planned', deviationActions: [], repairs: [], exposureStart: null });
    if (staged.kind !== 'Staged') throw new Error(staged.kind);
    tradeIds[i] = staged.mapping[prepared.candidate.tradeId]!;
  });

  const position = async (indices: readonly number[], minutes: (i: number) => number, action: 'Buy' | 'Sell', quantity: string, lifecycle: 'Open' | 'Closed') => {
    await phase(indices, async (i, tx) => {
      const current = await record.getRecord({ tradeId: tradeIds[i]!, projection: 'AnalysisInput' });
      if (current.kind !== 'Found') throw new Error(current.kind);
      const prepared = await record.prepareChange({
        kind: 'PositionChange',
        tradeId: tradeIds[i]!,
        expectedFactRevision: current.factRevision,
        executions: [execution(action, instant(minutes(i)), quantity)],
        ...(lifecycle === 'Closed' && { closeReasonId: 'catalog:close-reason-target-reached' }),
      });
      if (prepared.kind !== 'Prepared') throw new Error(prepared.kind);
      const staged = record.applyPreparedChange(tx, prepared, { candidateDigest: prepared.digest, expectedLifecycle: lifecycle, deviationActions: [], repairs: [], exposureStart: null });
      if (staged.kind !== 'Staged') throw new Error(staged.kind);
    });
  };
  // Planned to Open, a later entry, then an exit that closes every Trade but the ones kept Open.
  await position(all, (i) => count + i, 'Buy', '100', 'Open');
  await position(all, (i) => 2 * count + i, 'Buy', '10', 'Open');
  await position(all.slice(KEEP_OPEN), (i) => 3 * count + i, 'Sell', '110', 'Closed');

  const databaseName = created.databaseName;
  const churned = await openDatabase(databaseName);
  const churnedMs = await medianOpenRead(churned);
  const openRows = (await request(churned.transaction(['trades'], 'readonly').objectStore('trades').index('byLifecycleActivity').getAll(IDBKeyRange.bound(['Open'], ['Open', []])))).length;
  const documents = await request(churned.transaction(['trades'], 'readonly').objectStore('trades').getAll());
  churned.close();

  // The same documents in a database that never saw a key move: its indexes hold only live entries.
  const fresh = await openDatabase('fresh-copy', (db) => {
    const store = db.createObjectStore('trades', { keyPath: 'tradeId' });
    store.createIndex('byLifecycle', ['lifecycle', 'planTime', 'tradeId']);
    store.createIndex('byLifecycleActivity', ['lifecycle', 'activityDesc', 'tradeId']);
    store.createIndex('byLifecycleTerminal', ['lifecycle', 'terminalDesc', 'tradeId']);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = fresh.transaction(['trades'], 'readwrite');
    for (const document of documents) tx.objectStore('trades').put(document);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('write failed'));
  });
  const freshMs = await medianOpenRead(fresh);
  fresh.close();
  return { documents: documents.length, openRows, churnedMs, freshMs };
}

(window as unknown as { runChurn: typeof run }).runChurn = run;
