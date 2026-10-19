import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { assembleRead } from "../../src/persistence/indexeddb/snapshotRead";
import { close, openSeam, seed } from "./revision-support";

afterEach(async () => {
  await deleteDatabase();
});

describe("a multi-module read snapshot is coherent or explicitly reports changed-during-assembly", () => {
  it("should return one coherent view bound to the represented fact, observation, Journal and reference revisions when no writer commits during assembly", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "tradeRecord", { id: "trade-1", revision: 1 });
    await seed(seam, "journal", { id: "entry-1", revision: 1 });
    await seed(seam, "referenceCatalog", { id: "ref-1", revision: 1 });

    const result = await assembleRead(
      seam,
      [
        { name: "trade", store: "tradeRecord", read: (s) => s.rows("tradeRecord")[0] },
        { name: "journal", store: "journal", read: (s) => s.rows("journal")[0] },
        { name: "reference", store: "referenceCatalog", read: (s) => s.rows("referenceCatalog")[0] },
      ],
      { maxAttempts: 3 },
    );

    expect(result).toMatchObject({
      outcome: "Assembled",
      model: {
        trade: { id: "trade-1", revision: 1 },
        journal: { id: "entry-1", revision: 1 },
        reference: { id: "ref-1", revision: 1 },
      },
      binding: { tradeRecord: 1, journal: 1, referenceCatalog: 1 },
      attempts: 1,
    });

    await close(database);
  });

  it("should bind every returned read model to the exact revision set it was assembled from, so a caller cannot mistake a snapshot for a mutation binding", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "tradeRecord", { id: "trade-1", revision: 1 });

    const result = await assembleRead(
      seam,
      [{ name: "trade", store: "tradeRecord", read: (s) => s.rows("tradeRecord")[0] }],
      { maxAttempts: 3 },
    );

    const revisionRow = (await seam.snapshot(["workspaceMeta"])).rows("workspaceMeta").find(
      (row) => row.key === "revisions",
    );
    expect(result.outcome).toBe("Assembled");
    if (result.outcome === "Assembled") {
      expect(result.binding).toEqual(revisionRow?.value);
    }

    await close(database);
  });
});
