import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { commitLifecycleChange } from "../../src/persistence/indexeddb/lifecycleIndex";
import { close, openSeam } from "./revision-support";

afterEach(async () => {
  await deleteDatabase();
});

describe("lifecycle index membership commits with its facts and answers cutoff queries within a bounded read", () => {
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
