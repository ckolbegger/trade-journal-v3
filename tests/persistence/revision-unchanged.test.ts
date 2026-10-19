import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { commitRevisioned } from "../../src/persistence/indexeddb/revisions";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { close, openSeam, recovery, seed, writable } from "./revision-support";

afterEach(async () => {
  await deleteDatabase();
});

describe("optimistic revisions accept only the matching binding kind and return post-commit state without a read-back", () => {
  it("should leave every revision unchanged for each expected no-write result — Rejected, Conflict and RuntimeNotWritable — compared against a binding captured before the call", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "tradeRecord", { id: "trade-1", revision: 1, price: "10" });

    const fingerprint = async (): Promise<string> => {
      const snapshot = await seam.snapshot(["tradeRecord", "workspaceMeta"]);
      return JSON.stringify({
        tradeRecord: snapshot.rows("tradeRecord"),
        workspaceMeta: snapshot.rows("workspaceMeta"),
      });
    };
    const binding = await fingerprint();

    const conflict = await commitRevisioned(seam, {
      store: "tradeRecord",
      subjectId: "trade-1",
      expected: { kind: "recordRevision", subject: "trade-1", value: 0 },
      change: { price: "99" },
    });
    const wrongKind = await commitRevisioned(seam, {
      store: "tradeRecord",
      subjectId: "trade-1",
      expected: { kind: "querySnapshot", value: "snap-1" },
      change: { price: "99" },
    });
    const rejected = await commitRevisioned(seam, {
      store: "tradeRecord",
      subjectId: "missing",
      expected: { kind: "recordRevision", subject: "missing", value: 1 },
      change: { price: "99" },
    });
    const gated = createTransactionSeam(
      database,
      createWriteGate({ current: async () => recovery }),
    );
    const blocked = await commitRevisioned(gated, {
      store: "tradeRecord",
      subjectId: "trade-1",
      expected: { kind: "recordRevision", subject: "trade-1", value: 1 },
      change: { price: "99" },
    });

    expect(conflict.kind).toBe("Conflict");
    expect(wrongKind.kind).toBe("WrongBindingKind");
    expect(rejected).toEqual({ kind: "Rejected", reason: "missing-subject" });
    expect(blocked.kind).toBe("RuntimeNotWritable");
    expect(await fingerprint()).toBe(binding);

    await close(database);
    void writable;
  });
});
