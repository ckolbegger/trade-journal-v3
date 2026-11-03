// Bundled for the browser by stale-debt.spec.ts (T6.25-B3). It drives the production Persistence and Journal write path
// on Chromium's own IndexedDB: Debts are deferred and then resolved, and the read of `journalDebts.byOutstandingDue` is
// timed on that database and on a fresh one holding the same documents.
import { createPersistence, beginSemanticTransaction } from '../../src/persistence/index.ts';
import { createJournal, D2_JOURNAL_MANIFEST } from '../../src/modules/journal/index.ts';
import { fixedClock } from '../../src/domain/time/index.ts';

const BATCH = 100;
const KEEP_OUTSTANDING = 100;
const START = Date.parse('2026-01-02T14:00:00Z');
const instant = (minutes: number) => new Date(START + minutes * 60_000).toISOString().replace('.000Z', 'Z');
const OUTSTANDING_RANGE = () => IDBKeyRange.bound(['', ''], ['￿', '￿']);

const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error ?? new Error('request failed'));
});

// The median of repeated whole-range reads, each in its own read-only transaction.
async function medianOutstandingRead(db: IDBDatabase): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < 9; i++) {
    const t0 = performance.now();
    await request(db.transaction(['journalDebts'], 'readonly').objectStore('journalDebts').index('byOutstandingDue').getAll(OUTSTANDING_RANGE()));
    times.push(performance.now() - t0);
  }
  return times.sort((a, b) => a - b)[4]!;
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
  const journal = createJournal({ persistence, ids, clock: fixedClock('2026-10-13T16:30:00Z') });
  await journal.seedDefaults(D2_JOURNAL_MANIFEST);

  const commit = async (tx: ReturnType<typeof beginSemanticTransaction>) => {
    const result = await persistence.commit(tx.close());
    if (result.kind !== 'Committed') throw new Error(result.kind);
  };

  // Each batch merges its prepared effects into one commit, as a coordinator does.
  const defer = async (from: number, to: number) => {
    const mapping: Record<string, string> = {};
    let batch: Awaited<ReturnType<typeof journal.prepareEffects>> | undefined;
    for (let i = from; i < to; i++) {
      const prepared = await journal.prepareEffects({
        obligation: 'PositionChangeReflection',
        disposition: { kind: 'Defer' },
        anchor: { kind: 'Trade', ref: `trade-${i}` },
        origin: { kind: 'PositionChange', ref: `candidate:pc-${i}` },
        momentTime: instant(i),
      });
      if (prepared.kind !== 'Prepared') throw new Error(prepared.kind);
      mapping[`candidate:pc-${i}`] = `pc-${i}`;
      batch = batch?.kind === 'Prepared'
        ? { ...batch, effects: { ...batch.effects, debts: [...(batch.effects.debts ?? []), ...(prepared.effects.debts ?? [])] } }
        : prepared;
    }
    const tx = beginSemanticTransaction();
    const staged = journal.applyPreparedEffects(tx, batch as never, mapping);
    await commit(tx);
    return staged.debts!;
  };

  const debts: { debtId: string; revision: string }[] = [];
  for (let from = 0; from < count; from += BATCH) debts.push(...(await defer(from, Math.min(from + BATCH, count))));

  // Decline every Debt but the ones kept Outstanding, one batch per commit.
  const resolvable = debts.slice(KEEP_OUTSTANDING);
  for (let from = 0; from < resolvable.length; from += BATCH) {
    let batch: Awaited<ReturnType<typeof journal.prepareEffects>> | undefined;
    for (const debt of resolvable.slice(from, from + BATCH)) {
      const prepared = await journal.prepareEffects({ obligation: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Decline' } });
      if (prepared.kind !== 'Prepared') throw new Error(prepared.kind);
      batch = batch?.kind === 'Prepared'
        ? {
            ...batch,
            effects: {
              ...batch.effects,
              declines: [...batch.effects.declines, ...prepared.effects.declines],
              debtResolutions: [...batch.effects.debtResolutions!, ...prepared.effects.debtResolutions!],
            },
          }
        : prepared;
    }
    const tx = beginSemanticTransaction();
    journal.applyPreparedEffects(tx, batch as never, {});
    await commit(tx);
  }

  const churned = await request(indexedDB.open(created.databaseName));
  const churnedMs = await medianOutstandingRead(churned);
  const openRows = (await request(churned.transaction(['journalDebts'], 'readonly').objectStore('journalDebts').index('byOutstandingDue').getAll(OUTSTANDING_RANGE()))).length;
  const documents = await request(churned.transaction(['journalDebts'], 'readonly').objectStore('journalDebts').getAll());
  churned.close();

  // The same documents in a database that never saw a key move: its index holds only live entries.
  const open = indexedDB.open('fresh-copy', 1);
  open.onupgradeneeded = () => {
    const store = open.result.createObjectStore('journalDebts', { keyPath: 'debtId' });
    store.createIndex('byOutstandingDue', ['outstandingDue', 'debtId']);
  };
  const fresh = await request(open);
  await new Promise<void>((resolve, reject) => {
    const tx = fresh.transaction(['journalDebts'], 'readwrite');
    for (const document of documents) tx.objectStore('journalDebts').put(document);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('write failed'));
  });
  const freshMs = await medianOutstandingRead(fresh);
  fresh.close();
  return { documents: documents.length, openRows, churnedMs, freshMs };
}

(window as unknown as { runDebtChurn: typeof run }).runDebtChurn = run;
