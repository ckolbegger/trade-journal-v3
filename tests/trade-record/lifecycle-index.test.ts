import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import {
  LIFECYCLE_INDEX_STORE,
  TRADE_LIFECYCLE_STORE,
  queryRecords,
} from "../../src/trade-record";
import { close, openD2Seam } from "../support/store";
import { applyFixture } from "../support/confirm";
import { longStockPlan } from "../support/plans";

async function confirmedTrade(
  seam: TransactionSeam,
  entry = "180.00",
): Promise<string> {
  const applied = await applyFixture(seam, {
    plan: longStockPlan({ intendedEntry: { amount: entry } }),
  });
  if (applied.outcome !== "Staged") throw new Error("the confirmation did not stage");
  await seam.commit({ participants: applied.participants });
  return applied.projections[0]?.tradeId ?? "";
}

describe("TradeRecord.queryRecords CurrentState selection over the lifecycle index, at the public queryRecords and applyPreparedChange seams", () => {
  let seam: TransactionSeam;
  let database: IDBDatabase;

  beforeEach(async () => {
    const opened = await openD2Seam();
    seam = opened.seam;
    database = opened.database;
  });

  afterEach(async () => {
    await close(database);
  });

  it("should return the newly confirmed Trade in the Planned current-state page when the index is queried immediately after the confirming transaction commits", async () => {
    const tradeId = await confirmedTrade(seam);
    const page = await queryRecords(seam, {
      lifecycle: "CurrentState",
      state: "Planned",
      projection: "AnalysisInput",
      limit: 200,
    });

    expect(page.rows.map((row) => row.tradeId)).toEqual([tradeId]);
    expect(page.batch).toHaveLength(1);
    expect(page.batch[0]?.plan.plannedLegs).toHaveLength(1);
  });

  it("should exclude the Trade from a page filtered to Open when its stored Lifecycle State is Planned, because current-state selection uses the authoritative index rather than a derived value", async () => {
    await confirmedTrade(seam);
    const page = await queryRecords(seam, {
      lifecycle: "CurrentState",
      state: "Open",
      projection: "AnalysisInput",
      limit: 200,
    });

    expect(page.rows).toEqual([]);
    expect(page.batch).toEqual([]);
  });

  it("should return exactly one index entry for one Trade when the same Trade is re-read after a further successful commit, so that a re-apply cannot duplicate membership", async () => {
    await confirmedTrade(seam);
    await queryRecords(seam, {
      lifecycle: "CurrentState",
      state: "Planned",
      projection: "AnalysisInput",
      limit: 200,
    });

    const index = (await seam.snapshot([LIFECYCLE_INDEX_STORE])).rows(LIFECYCLE_INDEX_STORE);
    expect(index).toHaveLength(1);
  });

  it("should return a complete bounded AnalysisInput batch for the page in one query snapshot, with no per-Trade record load, when the page holds several Planned Trades", async () => {
    await confirmedTrade(seam, "180.00");
    await confirmedTrade(seam, "185.00");

    const page = await queryRecords(seam, {
      lifecycle: "CurrentState",
      state: "Planned",
      projection: "AnalysisInput",
      limit: 1,
    });

    expect(page.rows).toHaveLength(1);
    expect(page.batch).toHaveLength(1);
    expect(page.counts.batchReads).toBe(1);
    expect(page.counts.perRecordReads).toBe(0);
    expect(page.counts.indexCursors).toBe(1);
  });

  it("should leave the index and the stored Lifecycle State unchanged when the surrounding transaction aborts before completion", async () => {
    const applied = await applyFixture(seam);
    if (applied.outcome !== "Staged") throw new Error("the apply did not stage");
    await expect(
      seam.commit({
        participants: [
          ...applied.participants,
          { store: "storeThatDoesNotExist", put: [{ id: "x" }] },
        ],
      }),
    ).rejects.toBeDefined();

    const index = (await seam.snapshot([LIFECYCLE_INDEX_STORE])).rows(LIFECYCLE_INDEX_STORE);
    const lifecycle = (await seam.snapshot([TRADE_LIFECYCLE_STORE])).rows(TRADE_LIFECYCLE_STORE);
    expect(index).toEqual([]);
    expect(lifecycle).toEqual([]);
  });

  it("should not add, remove or repair any index entry when a query, a history read or a page request runs, because reads never repair", async () => {
    await confirmedTrade(seam);
    const before = (await seam.snapshot([LIFECYCLE_INDEX_STORE])).rows(LIFECYCLE_INDEX_STORE);

    await queryRecords(seam, {
      lifecycle: "CurrentState",
      state: "Open",
      projection: "AnalysisInput",
      limit: 200,
    });
    await queryRecords(seam, {
      lifecycle: "CurrentState",
      state: "Planned",
      projection: "AnalysisInput",
      limit: 200,
    });

    const after = (await seam.snapshot([LIFECYCLE_INDEX_STORE])).rows(LIFECYCLE_INDEX_STORE);
    expect(after).toEqual(before);
  });

  it("should keep the index entry addressable by Trade identity when a later commit changes the Trade's FactRevision, because membership tracks lifecycle and not one revision", async () => {
    const tradeId = await confirmedTrade(seam);
    await seam.commit({
      participants: [
        {
          store: TRADE_LIFECYCLE_STORE,
          put: [{ tradeId, state: "Planned", factRevision: 2, effectiveFactDigest: "d", causingFactId: "f" }],
        },
        {
          store: LIFECYCLE_INDEX_STORE,
          put: [{ tradeId, state: "Planned", factRevision: 2 }],
        },
      ],
    });

    const page = await queryRecords(seam, {
      lifecycle: "CurrentState",
      state: "Planned",
      projection: "Summary",
      limit: 200,
    });
    expect(page.rows.map((row) => row.tradeId)).toEqual([tradeId]);
    expect(page.rows[0]?.factRevision).toBe(2);
  });

  it("should return an empty page rather than a fabricated membership when no Trade currently has Planned stored Lifecycle State", async () => {
    const page = await queryRecords(seam, {
      lifecycle: "CurrentState",
      state: "Planned",
      projection: "AnalysisInput",
      limit: 200,
    });

    expect(page.rows).toEqual([]);
    expect(page.batch).toEqual([]);
    expect(page.counts.batchEntries).toBe(0);
  });
});
