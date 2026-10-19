import { describe, expect, it } from "vitest";
import { commitRevisioned, type RevisionedResult } from "../../src/persistence/indexeddb/revisions";
import { close, openSeam, seed } from "./revision-support";

function committed(result: RevisionedResult): Extract<RevisionedResult, { kind: "Committed" }> {
  if (result.kind !== "Committed") throw new Error(`expected Committed, received ${result.kind}`);
  return result;
}

describe("optimistic revisions accept only the matching binding kind and return post-commit state without a read-back", () => {
  it("should return the canonical post-commit representation of every directly changed subject so the caller renders the successful command without a follow-up read", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "tradeRecord", { id: "trade-1", revision: 1, price: "10", quantity: "5" });

    const result = committed(
      await commitRevisioned(seam, {
        store: "tradeRecord",
        subjectId: "trade-1",
        expected: { kind: "recordRevision", subject: "trade-1", value: 1 },
        change: { price: "11" },
      }),
    );

    const persisted = (await seam.snapshot(["tradeRecord"])).rows("tradeRecord")[0];
    expect(result.subject).toEqual(persisted);
    expect(result.revision).toEqual({
      kind: "recordRevision",
      subject: "trade-1",
      value: 2,
    });
    expect(result.workspaceContentRevision).toBe(1);

    await close(database);
  });
});
