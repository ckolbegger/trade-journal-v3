import { Temporal } from 'temporal-polyfill';
import { openDatabase } from './idb.ts';
import { activityDescOf, createWorkspaceIndexes } from './schema.ts';

// Drops every index of a Workspace database and recreates it through the migration path, in one
// version-change transaction, so every index is rebuilt from the stored records (AC-REBUILD-001).
// Private fields and the private obligation store are recomputed from authoritative records
// first (D2 A28, A139).
export async function rebuildPrivateState(indexedDB: IDBFactory, databaseName: string): Promise<void> {
  const existing = await openDatabase(indexedDB, databaseName, undefined);
  const version = existing.version;
  existing.close();
  const rebuilt = await openDatabase(indexedDB, databaseName, version + 1, (db, _oldVersion, tx) => {
    for (const name of Array.from(db.objectStoreNames)) {
      const store = tx.objectStore(name);
      for (const index of Array.from(store.indexNames)) store.deleteIndex(index);
    }
    recomputePrivateTradeFields(tx.objectStore('trades'));
    recomputePrivateDebtFields(tx.objectStore('journalDebts'));
    rebuildObligations(tx);
    createWorkspaceIndexes((name) => tx.objectStore(name));
  });
  rebuilt.close();
}

// Each Trade's private fields, from its stored facts: the Last Activity sort key (D2 A28) and
// `exposureStart` (D4 A38), the Economic Time of its first effective opening Execution.
function recomputePrivateTradeFields(trades: IDBObjectStore): void {
  const request = trades.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const trade = { ...(cursor.value as Record<string, unknown>) };
    delete trade['activityDesc'];
    delete trade['exposureStart'];
    if (typeof trade['lastActivity'] === 'string') trade['activityDesc'] = activityDescOf(trade['lastActivity']);
    const exposureStart = exposureStartOf(trade['facts']);
    if (exposureStart !== undefined) trade['exposureStart'] = exposureStart;
    cursor.update(trade);
    cursor.continue();
  };
}

interface StoredDebt {
  readonly obligationKey: string;
  readonly anchor: { readonly tradeId: string };
  readonly dueAnchor: string;
  readonly versions: readonly { readonly status: string }[];
  readonly debtId: string;
  readonly revision?: number;
}

// A Debt's private fields, from its authoritative record (D5 A62): the Trade it is anchored to, and
// the due anchor only while its latest version is Outstanding, so the sparse `byOutstandingDue`
// index holds only Outstanding Debt.
function recomputePrivateDebtFields(debts: IDBObjectStore): void {
  const request = debts.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const debt = { ...(cursor.value as Record<string, unknown>) } as Record<string, unknown> & StoredDebt;
    delete debt['outstandingDue'];
    debt['anchorTradeId'] = debt.anchor.tradeId;
    if (isOutstanding(debt)) debt['outstandingDue'] = debt.dueAnchor;
    cursor.update(debt);
    cursor.continue();
  };
}

function isOutstanding(debt: StoredDebt): boolean {
  return debt.versions[debt.versions.length - 1]!.status === 'Outstanding';
}

interface StoredFact {
  readonly kind: string;
  readonly versions: readonly { readonly value: { readonly economicTime: string } }[];
}

// The earliest Economic Time among a Trade's Executions, each at its latest version; undefined when
// it has none. Every Execution through D4 is an opening Buy, so each is an opening Execution.
function exposureStartOf(facts: unknown): string | undefined {
  const times = ((facts as readonly StoredFact[] | undefined) ?? [])
    .filter((fact) => fact.kind === 'Execution')
    .map((fact) => fact.versions[fact.versions.length - 1]!.value.economicTime);
  return times.sort((a, b) => Temporal.Instant.compare(a, b))[0];
}

// The Journal obligation index (D2 A28): one record per obligation key naming its current outcome,
// rebuilt from the Entries, declines, and Outstanding Debt that hold the key, each at the content revision its
// outcome was written at, since both were written by the same commit.
function rebuildObligations(tx: IDBTransaction): void {
  const obligations = tx.objectStore('journalObligations');
  obligations.clear();
  for (const [store, kind] of [['journalEntries', 'Entry'], ['journalDeclines', 'Decline']] as const) {
    const request = tx.objectStore(store).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const outcome = cursor.value as { id: string; obligationKey?: string; revision?: number };
      if (outcome.obligationKey !== undefined) {
        obligations.put({ obligationKey: outcome.obligationKey, outcome: { kind, id: outcome.id }, revision: outcome.revision });
      }
      cursor.continue();
    };
  }
  // An Outstanding Debt names its key's current outcome; a Settled or Declined Debt's outcome is the
  // Entry or decline above that carries its `settledDebtId` (D5 A62).
  const debts = tx.objectStore('journalDebts').openCursor();
  debts.onsuccess = () => {
    const cursor = debts.result;
    if (!cursor) return;
    const debt = cursor.value as StoredDebt;
    if (isOutstanding(debt)) {
      obligations.put({ obligationKey: debt.obligationKey, outcome: { kind: 'Debt', id: debt.debtId }, revision: debt.revision });
    }
    cursor.continue();
  };
}
