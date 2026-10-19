import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { assembleRead } from "../../src/persistence/indexeddb/snapshotRead";
import { close, openSeam, seed } from "./revision-support";

afterEach(async () => {
  await deleteDatabase();
});

describe("a multi-module read snapshot is coherent or explicitly reports changed-during-assembly", () => {
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
