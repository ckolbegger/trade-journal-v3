import { describe, expect, it } from "vitest";
import { commitRevisioned } from "../../src/persistence/indexeddb/revisions";
import { close, openSeam, seed } from "./revision-support";

describe("optimistic revisions accept only the matching binding kind and return post-commit state without a read-back", () => {
  it("should increment the Workspace content revision exactly once per committed semantic command even when several stores participate", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "tradeRecord", { id: "trade-1", revision: 1, price: "10" });

    const first = await commitRevisioned(seam, {
      store: "tradeRecord",
      subjectId: "trade-1",
      expected: { kind: "recordRevision", subject: "trade-1", value: 1 },
      change: { price: "11" },
      additionalParticipants: [
        { store: "journal", put: [{ id: "entry-1" }] },
        { store: "referenceCatalog", put: [{ id: "ref-1" }] },
      ],
    });
    expect(first).toMatchObject({ kind: "Committed", workspaceContentRevision: 1 });

    const second = await commitRevisioned(seam, {
      store: "tradeRecord",
      subjectId: "trade-1",
      expected: { kind: "recordRevision", subject: "trade-1", value: 2 },
      change: { price: "12" },
    });
    expect(second).toMatchObject({ kind: "Committed", workspaceContentRevision: 2 });

    await close(database);
  });
});
