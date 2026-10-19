import { describe, expect, it } from "vitest";
import { commitRevisioned } from "../../src/persistence/indexeddb/revisions";
import { close, openSeam, seed } from "./revision-support";

describe("optimistic revisions accept only the matching binding kind and return post-commit state without a read-back", () => {
  it("should reject a query snapshot token supplied where a mutation revision is required with a typed WrongBindingKind and no write", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "tradeRecord", { id: "trade-1", revision: 1, price: "10" });

    const result = await commitRevisioned(seam, {
      store: "tradeRecord",
      subjectId: "trade-1",
      expected: { kind: "querySnapshot", value: "snap-1" },
      change: { price: "99" },
    });

    expect(result).toEqual({
      kind: "WrongBindingKind",
      expected: "querySnapshot",
      required: "recordRevision",
    });
    const snapshot = await seam.snapshot(["tradeRecord"]);
    expect(snapshot.rows("tradeRecord")[0]).toMatchObject({ price: "10" });

    await close(database);
  });
});
