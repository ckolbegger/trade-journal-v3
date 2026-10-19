import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults, type CatalogSeedManifest } from "../../src/catalog";
import { catalogRows, closeCatalog, openCatalog } from "../support/domains";
import { TransactionSeam } from "../../src/persistence/indexeddb/transaction";

const manifest: CatalogSeedManifest = {
  version: "catalog-seed-test",
  strategies: [
    { stableKey: "strategy.long-stock", label: "Long Stock", shape: { roles: [{ side: "long", kind: "stock", quantity: "1" }], constraints: [] } },
    { stableKey: "strategy.long-call", label: "Long Call", shape: { roles: [{ side: "long", kind: "call", quantity: "1" }], constraints: [] } },
    { stableKey: "strategy.trader-reflection", label: "Late Seed", shape: { roles: [], constraints: [] } },
  ],
};

describe("ReferenceCatalog.seedDefaults seeds exactly manifest v1's declared identities and reports the catalog state", () => {
  it("should create no seeded Institution, no seeded Account, no Close Reason, no Abandonment Reason, no generic Custom or Other Strategy, no settlement-derived reason value and no Tag Type", async () => {
      const { database, seam } = await openCatalog();
      await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

      const rows = await catalogRows(seam);
      const kinds = new Set(rows.map((row) => row.kind));
      const labels = rows.map((row) => String(row.label).toLowerCase());

      expect([...kinds]).toEqual(["strategy"]);
      expect(kinds.has("institution")).toBe(false);
      expect(kinds.has("account")).toBe(false);
      expect(kinds.has("closeReason")).toBe(false);
      expect(kinds.has("abandonmentReason")).toBe(false);
      expect(kinds.has("tagType")).toBe(false);
      expect(kinds.has("tagValue")).toBe(false);
      for (const forbidden of ["custom", "other", "expired", "assigned", "exercised", "never filled"]) {
        expect(labels).not.toContain(forbidden);
      }

      await closeCatalog(database);
    });

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

  it("should be idempotent and stable-keyed: a second seed with the same manifest adds nothing, and a reworded label never causes a duplicate identity", async () => {
      const { database, seam } = await openCatalog();
      const first = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
      const second = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

      const reworded = await seedDefaults(seam, {
        ...CATALOG_SEED_MANIFEST_V1,
        strategies: CATALOG_SEED_MANIFEST_V1.strategies.map((strategy) => ({
          ...strategy,
          label: "Long Stock Position",
        })),
      });

      expect(second).toMatchObject({ outcome: "Seeded", additions: [] });
      expect(reworded).toMatchObject({ outcome: "Seeded", additions: [] });
      expect((await catalogRows(seam)).filter((row) => row.kind === "strategy")).toHaveLength(1);
      if (first.outcome === "Seeded" && second.outcome === "Seeded") {
        expect(first.catalog.revision).toBe(second.catalog.revision);
      }

      await closeCatalog(database);
    });

  it("should create exactly the Long Stock Strategy under its stable product key with one long Stock role and the contract's shape vocabulary, and no other Strategy", async () => {
      const { database, seam } = await openCatalog();

      const result = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

      expect(result).toMatchObject({
        outcome: "Seeded",
        seedVersion: "catalog-seed-v1",
        additions: ["strategy.long-stock"],
      });
      const strategies = (await catalogRows(seam)).filter((row) => row.kind === "strategy");
      expect(strategies).toHaveLength(1);
      expect(strategies[0]).toMatchObject({
        stableKey: "strategy.long-stock",
        label: "Long Stock",
        revision: 1,
        retired: false,
        shape: {
          roles: [{ side: "long", kind: "stock", quantity: "1" }],
          constraints: [{ kind: "sameUnderlying", detail: "one Underlying" }],
        },
      });

      await closeCatalog(database);
    });

  it("should retain a trader rename and not reactivate a legitimately retired seed, returning the retained current label and availability", async () => {
      const { database, seam } = await openCatalog();
      await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

      const strategy = (await catalogRows(seam)).find((row) => row.kind === "strategy") as Record<
        string,
        unknown
      >;
      await seam.commit({
        participants: [
          {
            store: "referenceCatalog",
            put: [{ ...strategy, label: "My Long Stock", retired: true, revision: 2 }],
          },
        ],
      });

      const result = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

      expect(result).toMatchObject({ outcome: "Seeded", additions: [] });
      if (result.outcome === "Seeded") {
        expect(result.catalog.strategies[0]).toMatchObject({
          label: "My Long Stock",
          retired: true,
        });
      }
      const after = (await catalogRows(seam)).find((row) => row.kind === "strategy") as Record<
        string,
        unknown
      >;
      expect(after.revision).toBe(2);
      expect(after.label).toBe("My Long Stock");
      expect(after.retired).toBe(true);

      await closeCatalog(database);
    });

  it("should return a typed SeedConflict and write nothing when a known stable product key already exists with an incompatible shape", async () => {
      const { database, seam } = await openCatalog();
      await seam.commit({
        participants: [
          {
            store: "referenceCatalog",
            put: [
              {
                id: "strategy:strategy.long-stock",
                kind: "strategy",
                stableKey: "strategy.long-stock",
                label: "Long Stock",
                revision: 1,
                retired: false,
                shape: {
                  roles: [
                    { side: "long", kind: "stock", quantity: "1" },
                    { side: "long", kind: "call", quantity: "1" },
                  ],
                  constraints: [],
                },
              },
            ],
          },
        ],
      });
      const before = JSON.stringify(await catalogRows(seam));

      const result = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

      expect(result).toMatchObject({
        outcome: "SeedConflict",
        stableKey: "strategy.long-stock",
      });
      expect(JSON.stringify(await catalogRows(seam))).toBe(before);

      await closeCatalog(database);
    });

  it("should return the resulting Catalog snapshot, the exact additions and the selectable-Account summary Workspace needs for onboarding without a follow-up query", async () => {
      const { database, seam } = await openCatalog();

      const result = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

      expect(result.outcome).toBe("Seeded");
      if (result.outcome === "Seeded") {
        expect(result.additions).toEqual(["strategy.long-stock"]);
        expect(result.catalog.strategies).toEqual([
          {
            stableKey: "strategy.long-stock",
            label: "Long Stock",
            shape: CATALOG_SEED_MANIFEST_V1.strategies[0]?.shape,
            retired: false,
          },
        ]);
        expect(result.catalog.revision).toBe(1);
        expect(result.selectableAccounts).toEqual([]);
      }

      await closeCatalog(database);
    });
});
