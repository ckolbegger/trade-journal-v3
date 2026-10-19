import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { queryOpenAtCutoff } from "../../src/persistence/indexeddb/lifecycleIndex";
import { close, openSeam, seed } from "./revision-support";

afterEach(async () => {
  await deleteDatabase();
});

describe("lifecycle index membership commits with its facts and answers cutoff queries within a bounded read", () => {
  it("should return the Trades that were Open at a past completed-session cutoff from membership facts, including one that has since closed, rather than from current membership", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "lifecycleIndex", {
      tradeId: "trade-open",
      state: "Open",
      factRevision: 4,
      openedOn: "2026-10-01",
    });
    await seed(seam, "lifecycleIndex", {
      tradeId: "trade-closed-since",
      state: "Closed",
      factRevision: 9,
      openedOn: "2026-10-01",
      closedOn: "2026-10-20",
    });
    await seed(seam, "lifecycleIndex", {
      tradeId: "trade-opened-later",
      state: "Open",
      factRevision: 2,
      openedOn: "2026-10-22",
    });

    const earlier = await queryOpenAtCutoff(seam, "2026-10-15");
    const later = await queryOpenAtCutoff(seam, "2026-10-21");

    expect(earlier.map((entry) => entry.tradeId).sort()).toEqual([
      "trade-closed-since",
      "trade-open",
    ]);
    expect(later.map((entry) => entry.tradeId).sort()).toEqual(["trade-open"]);

    await close(database);
  });
});
