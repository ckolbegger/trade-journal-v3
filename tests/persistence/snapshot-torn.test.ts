import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { assembleRead } from "../../src/persistence/indexeddb/snapshotRead";
import { close, openSeam, seed } from "./revision-support";

afterEach(async () => {
  await deleteDatabase();
});

describe("a multi-module read snapshot is coherent or explicitly reports changed-during-assembly", () => {
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
