import { describe, expect, it } from "vitest";
import { commitRevisioned } from "../../src/persistence/indexeddb/revisions";
import { close, openSeam, seed } from "./revision-support";

describe("optimistic revisions accept only the matching binding kind and return post-commit state without a read-back", () => {
  it("should commit and return the new record revision when the supplied expected revision equals the current one", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "tradeRecord", { id: "trade-1", revision: 1, price: "10" });

    const result = await commitRevisioned(seam, {
      store: "tradeRecord",
      subjectId: "trade-1",
      expected: { kind: "recordRevision", subject: "trade-1", value: 1 },
      change: { price: "11" },
    });

    expect(result).toMatchObject({
      kind: "Committed",
      revision: { kind: "recordRevision", subject: "trade-1", value: 2 },
      subject: { id: "trade-1", revision: 2, price: "11" },
    });
    await close(database);
  });
});
