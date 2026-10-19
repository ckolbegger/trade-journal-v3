/**
 * One bounded Open selection: one cursor over the authoritative lifecycle index collects at most
 * `batchSize` Open identities, then one batch read fetches those facts. Nothing here replays
 * history or issues one query per Trade.
 */
export interface OpenLifecycleQuery {
  readonly batchSize: number;
}

export interface LifecycleListRow {
  readonly tradeId: string;
  readonly state: string;
  readonly cutoffTradingDate?: string;
}

export interface QueryCounts {
  readonly indexCursors: number;
  readonly cursorSteps: number;
  /** One logical batch read, however many member records it fetches. */
  readonly batchReads: number;
  readonly batchEntries: number;
}

export interface OpenLifecycleResult {
  readonly rows: readonly LifecycleListRow[];
  readonly batch: readonly unknown[];
  readonly counts: QueryCounts;
}

export function queryOpenLifecycle(
  database: IDBDatabase,
  query: OpenLifecycleQuery,
): Promise<OpenLifecycleResult> {
  return new Promise<OpenLifecycleResult>((resolve, reject) => {
    const transaction = database.transaction(["lifecycleIndex", "tradeRecord"], "readonly");
    const index = transaction.objectStore("lifecycleIndex").index("state");
    const rows: LifecycleListRow[] = [];
    let cursorSteps = 0;
    let finished = false;

    const finish = (): void => {
      if (finished) return;
      finished = true;
      const store = transaction.objectStore("tradeRecord");
      const requests = rows.map((row) => store.get(row.tradeId));
      Promise.all(
        requests.map(
          (request) =>
            new Promise<unknown>((resolveEntry, rejectEntry) => {
              request.onsuccess = () => resolveEntry(request.result);
              request.onerror = () =>
                rejectEntry(request.error ?? new Error("the bounded batch read failed"));
            }),
        ),
      ).then(
        (batch) =>
          resolve({
            rows,
            batch,
            counts: {
              indexCursors: 1,
              cursorSteps,
              batchReads: 1,
              batchEntries: rows.length,
            },
          }),
        reject,
      );
    };

    const cursorRequest = index.openCursor(IDBKeyRange.only("Open"));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor === null || rows.length >= query.batchSize) {
        finish();
        return;
      }
      cursorSteps += 1;
      rows.push(cursor.value as LifecycleListRow);
      cursor.continue();
    };
    cursorRequest.onerror = () =>
      reject(cursorRequest.error ?? new Error("the lifecycle index cursor failed"));
  });
}
