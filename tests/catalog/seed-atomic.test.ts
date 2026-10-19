import { describe, expect, it } from "vitest";
import { seedDefaults, type CatalogSeedManifest } from "../../src/catalog";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { catalogRows, closeCatalog, openCatalog } from "./support";

const manifest: CatalogSeedManifest = {
  version: "catalog-seed-test",
  strategies: [
    { stableKey: "strategy.long-stock", label: "Long Stock", shape: { roles: [{ side: "long", kind: "stock", quantity: "1" }], constraints: [] } },
    { stableKey: "strategy.long-call", label: "Long Call", shape: { roles: [{ side: "long", kind: "call", quantity: "1" }], constraints: [] } },
    { stableKey: "strategy.trader-reflection", label: "Late Seed", shape: { roles: [], constraints: [] } },
  ],
};

describe("ReferenceCatalog.seedDefaults seeds exactly manifest v1's declared identities and reports the catalog state", () => {
  it("should commit every seeded identity, immutable shape and seed-manifest state in one transaction so an interrupted seed leaves no partial catalog", async () => {
    const { database, seam } = await openCatalog();
    const failingSeam: TransactionSeam = {
      snapshot: (stores) => seam.snapshot(stores),
      counters: seam.counters,
      commit: (request) => {
        const rows = request.participants.flatMap((participant) => participant.put ?? []);
        if (rows.some((row) => row.stableKey === "strategy.trader-reflection")) {
          return Promise.reject(new Error("injected storage failure"));
        }
        return seam.commit(request);
      },
    };

    await expect(seedDefaults(failingSeam, manifest)).rejects.toBeTruthy();
    expect(await catalogRows(seam)).toEqual([]);

    await closeCatalog(database);
  });
});
