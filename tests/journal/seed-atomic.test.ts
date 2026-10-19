import { describe, expect, it } from "vitest";
import { SEED_MANIFEST_FULL, seedDefaults } from "../../src/journal";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { closeJournal, journalRows, openJournal } from "./support";

describe("Journal.seedDefaults creates only the manifest's declared fixed identities, atomically and idempotently", () => {
  it("should commit every seeded identity, definition revision and Source in one transaction, so an interrupted seed leaves no partial Journal configuration", async () => {
    const { database, seam } = await openJournal();
    // The failure is injected into whichever commit carries a late identity. A single-transaction
    // seed loses everything; a per-identity seed would leave the earlier identities committed.
    const failingSeam: TransactionSeam = {
      snapshot: (stores) => seam.snapshot(stores),
      counters: seam.counters,
      commit: (request) => {
        const rows = request.participants.flatMap((participant) => participant.put ?? []);
        if (rows.some((row) => row.stableKey === "entryType.review-note")) {
          return Promise.reject(new Error("injected storage failure"));
        }
        return seam.commit(request);
      },
    };

    await expect(seedDefaults(failingSeam, SEED_MANIFEST_FULL)).rejects.toBeTruthy();
    expect(await journalRows(seam)).toEqual([]);

    await closeJournal(database);
  });
});
