import { describe, expect, it, afterEach } from "vitest";
import { commitRevisioned, type RevisionedResult } from "../../src/persistence/indexeddb/revisions";
import { close, openSeam, seed, recovery, writable } from "./revision-support";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";

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

describe("optimistic revisions accept only the matching binding kind and return post-commit state without a read-back", () => {
  function committed(result: RevisionedResult): Extract<RevisionedResult, { kind: "Committed" }> {
    if (result.kind !== "Committed") throw new Error(`expected Committed, received ${result.kind}`);
    return result;
  }

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

describe("optimistic revisions accept only the matching binding kind and return post-commit state without a read-back", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

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

describe("optimistic revisions accept only the matching binding kind and return post-commit state without a read-back", () => {
  it("should preserve fact identity while appending exactly one immutable version when a retained reference is corrected through the seam", async () => {
      const { database, seam } = await openSeam();
      await seed(seam, "tradeRecord", {
        id: "trade-1",
        revision: 1,
        price: "10",
        versions: [{ revision: 1, price: "10" }],
      });

      const result = await commitRevisioned(seam, {
        store: "tradeRecord",
        subjectId: "trade-1",
        expected: { kind: "recordRevision", subject: "trade-1", value: 1 },
        change: { price: "11" },
      });

      expect(result).toMatchObject({
        kind: "Committed",
        subject: {
          id: "trade-1",
          revision: 2,
          versions: [
            { revision: 1, price: "10" },
            { revision: 2, price: "11" },
          ],
        },
      });
      await close(database);
    });
});
