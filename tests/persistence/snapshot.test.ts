import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { assembleRead } from "../../src/persistence/indexeddb/snapshotRead";
import { close, openSeam, seed } from "./revision-support";

describe("a multi-module read snapshot is coherent or explicitly reports changed-during-assembly", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

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

describe("a multi-module read snapshot is coherent or explicitly reports changed-during-assembly", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  it("should leave every store byte-identical after the read, compared against a digest captured before it", async () => {
      const { database, seam } = await openSeam();
      await seed(seam, "tradeRecord", { id: "trade-1", revision: 1 });
      await seed(seam, "journal", { id: "entry-1", revision: 1 });

      const fingerprint = async (): Promise<string> => {
        const snapshot = await seam.snapshot(["tradeRecord", "journal", "workspaceMeta"]);
        return JSON.stringify({
          tradeRecord: snapshot.rows("tradeRecord"),
          journal: snapshot.rows("journal"),
          workspaceMeta: snapshot.rows("workspaceMeta"),
        });
      };
      const before = await fingerprint();

      await assembleRead(
        seam,
        [
          { name: "trade", store: "tradeRecord", read: (s) => s.rows("tradeRecord")[0] },
          { name: "journal", store: "journal", read: (s) => s.rows("journal")[0] },
        ],
        { maxAttempts: 3 },
      );

      expect(await fingerprint()).toBe(before);
      await close(database);
    });

  it("should read the pre-commit rows for its whole lifetime when the snapshot begins before a concurrent commit completes", async () => {
      const { database, seam } = await openSeam();
      await seed(seam, "tradeRecord", { id: "trade-1", revision: 1 });

      const snapshot = await seam.snapshot(["tradeRecord"]);
      await seam.commit({
        participants: [{ store: "tradeRecord", put: [{ id: "trade-2", revision: 1 }] }],
      });

      expect(snapshot.rows("tradeRecord")).toEqual([{ id: "trade-1", revision: 1 }]);
      await close(database);
    });
});

describe("a multi-module read snapshot is coherent or explicitly reports changed-during-assembly", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  it("should return ChangedDuringAssembly naming the changed revisions, and never a mixed result, when a writer commits between two module reads", async () => {
      const { database, seam } = await openSeam();
      await seed(seam, "tradeRecord", { id: "trade-1", revision: 1 });
      await seed(seam, "journal", { id: "entry-1", revision: 1 });

      const result = await assembleRead(
        seam,
        [
          { name: "trade", store: "tradeRecord", read: (s) => s.rows("tradeRecord")[0] },
          {
            name: "journal",
            store: "journal",
            read: async (s) => {
              await seam.commit({
                participants: [{ store: "journal", put: [{ id: "entry-2", revision: 2 }] }],
              });
              return s.rows("journal")[0];
            },
          },
        ],
        { maxAttempts: 1 },
      );

      expect(result).toEqual({
        outcome: "ChangedDuringAssembly",
        changedRevisions: { journal: { expected: 1, observed: 2 } },
        attempts: 1,
      });
      expect(result).not.toHaveProperty("model");

      await close(database);
    });

  it("should stop after the configured bounded number of attempts and return ChangedDuringAssembly rather than retrying without limit", async () => {
      const { database, seam } = await openSeam();
      await seed(seam, "journal", { id: "entry-0", revision: 1 });
      let reads = 0;

      const result = await assembleRead(
        seam,
        [
          {
            name: "journal",
            store: "journal",
            read: async (s) => {
              reads += 1;
              await seam.commit({
                participants: [{ store: "journal", put: [{ id: `entry-${reads + 1}` }] }],
              });
              return s.rows("journal")[0];
            },
          },
        ],
        { maxAttempts: 3 },
      );

      expect(result).toMatchObject({ outcome: "ChangedDuringAssembly", attempts: 3 });
      expect(reads).toBe(3);

      await close(database);
    });
});
