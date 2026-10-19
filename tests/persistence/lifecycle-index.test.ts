import { afterAll, beforeAll, describe, expect, it, afterEach } from "vitest";
import { deleteDatabase, openDatabase, transactionDone, rebuildProjections } from "../../src/persistence/indexeddb/schema";
import { queryOpenLifecycle } from "../../src/persistence/indexeddb/lifecycleQuery";
import { type TransactionSeam, createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { writable, close, openSeam, seed } from "./revision-support";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { queryOpenAtCutoff, readTradeAgreement, commitLifecycleChange } from "../../src/persistence/indexeddb/lifecycleIndex";

describe("lifecycle index membership commits with its facts and answers cutoff queries within a bounded read", () => {
  const TOTAL = 25_000;

  const OPEN = 200;

  const BATCH = 250;

  let database: IDBDatabase;

  let seam: TransactionSeam;

  beforeAll(async () => {
    database = await openDatabase();
    const transaction = database.transaction(["lifecycleIndex", "tradeRecord"], "readwrite");
    const lifecycle = transaction.objectStore("lifecycleIndex");
    const trades = transaction.objectStore("tradeRecord");
    for (let index = 0; index < TOTAL; index += 1) {
      const open = index < OPEN;
      lifecycle.put({
        tradeId: `trade-${index}`,
        state: open ? "Open" : "Closed",
        factRevision: index,
        openedOn: "2026-10-01",
        ...(open ? {} : { closedOn: "2026-10-20" }),
      });
      trades.put({ id: `trade-${index}`, tradeId: `trade-${index}`, kind: "execution" });
    }
    await transactionDone(transaction);
    seam = createTransactionSeam(database, createWriteGate({ current: async () => writable }));
  });

  afterAll(async () => {
    database.close();
    await deleteDatabase();
  });

  it("should return only the currently Open Trades from the index, reading one indexed cursor plus the declared bounded batch rather than scanning the Trade store", async () => {
      const result = await queryOpenLifecycle(database, { batchSize: BATCH });

      expect(result.rows).toHaveLength(OPEN);
      expect(result.rows.every((row) => row.state === "Open")).toBe(true);
      expect(result.batch).toHaveLength(OPEN);
    });

  it("should stay bounded at 25,000 Trades: the query reads at most the declared batch plus the indexed rows, asserted by the counted storage requests and never by elapsed time", async () => {
      const result = await queryOpenLifecycle(database, { batchSize: BATCH });

      expect(result.counts).toEqual({
        indexCursors: 1,
        cursorSteps: OPEN,
        batchReads: 1,
        batchEntries: OPEN,
      });
      expect(result.rows.length).toBeLessThanOrEqual(BATCH);
      expect(seam.counters.readwriteTransactions).toBe(0);
    });
});

describe("lifecycle index membership commits with its facts and answers cutoff queries within a bounded read", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  it("should return the Trades that were Open at a past completed-session cutoff from membership facts, including one that has since closed, rather than from current membership", async () => {
      const { database, seam } = await openSeam();
      await seed(seam, "lifecycleIndex", {
        tradeId: "trade-open",
        state: "Open",
        factRevision: 4,
        openedOn: "2026-10-01",
      });
      await seed(seam, "lifecycleIndex", {
        tradeId: "trade-closed-since",
        state: "Closed",
        factRevision: 9,
        openedOn: "2026-10-01",
        closedOn: "2026-10-20",
      });
      await seed(seam, "lifecycleIndex", {
        tradeId: "trade-opened-later",
        state: "Open",
        factRevision: 2,
        openedOn: "2026-10-22",
      });

      const earlier = await queryOpenAtCutoff(seam, "2026-10-15");
      const later = await queryOpenAtCutoff(seam, "2026-10-21");

      expect(earlier.map((entry) => entry.tradeId).sort()).toEqual([
        "trade-closed-since",
        "trade-open",
      ]);
      expect(later.map((entry) => entry.tradeId).sort()).toEqual(["trade-open"]);

      await close(database);
    });
});

describe("lifecycle index membership commits with its facts and answers cutoff queries within a bounded read", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  it("should surface a structured disagreement, and never repair it, when stored membership for a Trade contradicts its effective facts", async () => {
      const { database, seam } = await openSeam();
      await seed(seam, "lifecycleIndex", {
        tradeId: "trade-1",
        state: "Open",
        factRevision: 2,
        openedOn: "2026-10-01",
      });
      await seed(seam, "tradeRecord", {
        id: "execution-1",
        tradeId: "trade-1",
        kind: "execution",
        side: "buy",
        quantity: "10",
      });
      await seed(seam, "tradeRecord", {
        id: "execution-2",
        tradeId: "trade-1",
        kind: "execution",
        side: "sell",
        quantity: "10",
      });

      const fingerprint = async (): Promise<string> => {
        const snapshot = await seam.snapshot(["lifecycleIndex", "tradeRecord"]);
        return JSON.stringify({
          lifecycleIndex: snapshot.rows("lifecycleIndex"),
          tradeRecord: snapshot.rows("tradeRecord"),
        });
      };
      const before = await fingerprint();

      const read = await readTradeAgreement(seam, "trade-1");

      expect(read?.agreement).toEqual({
        outcome: "Disagreement",
        tradeId: "trade-1",
        storedState: "Open",
        derivedState: "Closed",
      });
      expect(await fingerprint()).toBe(before);

      await close(database);
    });
});

describe("lifecycle index membership commits with its facts and answers cutoff queries within a bounded read", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  it("should write the lifecycle index membership inside the same transaction as the lifecycle-changing facts, so a committed fact and its membership cannot disagree", async () => {
      const { database, seam } = await openSeam();

      const result = await commitLifecycleChange(seam, {
        entry: {
          tradeId: "trade-1",
          state: "Open",
          factRevision: 3,
          openedOn: "2026-10-19",
          cutoffTradingDate: "2026-10-19",
        },
        facts: [
          {
            store: "tradeRecord",
            put: [
              { id: "execution-1", tradeId: "trade-1", kind: "execution", side: "buy", quantity: "10" },
            ],
          },
        ],
      });

      expect(result).toMatchObject({ kind: "Committed" });
      expect(seam.counters.readwriteTransactions).toBe(1);
      const snapshot = await seam.snapshot(["lifecycleIndex", "tradeRecord"]);
      expect(snapshot.rows("lifecycleIndex")).toEqual([
        {
          tradeId: "trade-1",
          state: "Open",
          factRevision: 3,
          openedOn: "2026-10-19",
          cutoffTradingDate: "2026-10-19",
        },
      ]);
      expect(snapshot.rows("tradeRecord")[0]).toMatchObject({ id: "execution-1" });

      await close(database);
    });

  it("should fail the whole transaction when a required index membership write fails, leaving the facts unwritten", async () => {
      const { database, seam } = await openSeam();

      await expect(
        commitLifecycleChange(seam, {
          entry: {
            tradeId: "trade-2",
            state: "Open",
            factRevision: 1,
            openedOn: "2026-10-19",
          },
          facts: [
            // The fact store participant cannot be written: no keyPath value.
            { store: "tradeRecord", put: [{ notAKey: true }] },
          ],
        }),
      ).rejects.toBeTruthy();

      const snapshot = await seam.snapshot(["lifecycleIndex", "tradeRecord"]);
      expect(snapshot.rows("lifecycleIndex")).toEqual([]);
      expect(snapshot.rows("tradeRecord")).toEqual([]);

      await close(database);
    });
});

describe("lifecycle index membership commits with its facts and answers cutoff queries within a bounded read", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  it("should rebuild membership from authoritative facts and prove recomputed membership equals the rebuilt index after the projection is deliberately deleted", async () => {
      const { database, seam } = await openSeam();
      await seed(seam, "lifecycleIndex", {
        tradeId: "trade-1",
        state: "Open",
        factRevision: 5,
        openedOn: "2026-10-01",
      });
      await seed(seam, "lifecycleIndex", {
        tradeId: "trade-2",
        state: "Closed",
        factRevision: 8,
        openedOn: "2026-10-01",
        closedOn: "2026-10-20",
      });

      const indexRows = (await seam.snapshot(["lifecycleIndex"])).rows("lifecycleIndex");

      await rebuildProjections(database);
      const firstProjection = (await seam.snapshot(["lifecycleListProjection"])).rows(
        "lifecycleListProjection",
      );

      const clear = database.transaction("lifecycleListProjection", "readwrite");
      clear.objectStore("lifecycleListProjection").clear();
      await new Promise<void>((resolve, reject) => {
        clear.oncomplete = () => resolve();
        clear.onerror = () => reject(clear.error);
      });
      expect((await seam.snapshot(["lifecycleListProjection"])).rows("lifecycleListProjection")).toEqual(
        [],
      );

      await rebuildProjections(database);
      const secondProjection = (await seam.snapshot(["lifecycleListProjection"])).rows(
        "lifecycleListProjection",
      );

      expect(secondProjection).toEqual(firstProjection);
      expect(secondProjection.map((row) => row.tradeId).sort()).toEqual(
        indexRows.map((row) => row.tradeId).sort(),
      );
      expect(secondProjection.every((row) => typeof row.factRevision === "number")).toBe(true);

      await close(database);
    });
});
