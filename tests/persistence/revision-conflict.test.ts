import { describe, expect, it } from "vitest";
import { commitRevisioned } from "../../src/persistence/indexeddb/revisions";
import { close, openSeam, seed } from "./revision-support";

describe("optimistic revisions accept only the matching binding kind and return post-commit state without a read-back", () => {
  it("should return a typed Conflict carrying the current revision and the changed domains, and write nothing, when the supplied expected revision is stale", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "tradeRecord", { id: "trade-1", revision: 1, price: "10" });
    await commitRevisioned(seam, {
      store: "tradeRecord",
      subjectId: "trade-1",
      expected: { kind: "recordRevision", subject: "trade-1", value: 1 },
      change: { price: "11" },
    });

    const stale = await commitRevisioned(seam, {
      store: "tradeRecord",
      subjectId: "trade-1",
      expected: { kind: "recordRevision", subject: "trade-1", value: 1 },
      change: { price: "99", quantity: "5" },
    });

    expect(stale).toEqual({
      kind: "Conflict",
      current: { kind: "recordRevision", subject: "trade-1", value: 2 },
      changedDomains: ["price", "quantity"],
    });
    const snapshot = await seam.snapshot(["tradeRecord"]);
    expect(snapshot.rows("tradeRecord")[0]).toMatchObject({ id: "trade-1", revision: 2, price: "11" });

    await close(database);
  });
});
