import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CATALOG_SEED_MANIFEST_V1,
  CATALOG_SEED_MANIFEST_V2,
  resolve,
  seedDefaults,
  type CatalogSnapshot,
} from "../../src/catalog";
import { save } from "../../src/catalog/save";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { close, openD2Seam } from "../support/store";

const LONG_STOCK = "strategy.long-stock";

async function seedV1(seam: TransactionSeam): Promise<CatalogSnapshot> {
  const seeded = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
  if (seeded.outcome !== "Seeded") throw new Error("the v1 seed did not run");
  return seeded.catalog;
}

async function createAccountFixture(seam: TransactionSeam): Promise<string> {
  const institution = await save(seam, {
    type: "createInstitution",
    label: "Fidelity",
    expectedSnapshotRevision: (await revision(seam)).revision,
  });
  if (institution.outcome !== "Saved") throw new Error("the Institution was not created");
  const account = await save(seam, {
    type: "createAccount",
    institutionId: institution.identity,
    label: "Brokerage One",
    expectedSnapshotRevision: (await revision(seam)).revision,
  });
  if (account.outcome !== "Saved") throw new Error("the Account was not created");
  return account.identity;
}

async function revision(seam: TransactionSeam): Promise<{ revision: number }> {
  const snapshot = await seam.snapshot(["workspaceMeta"]);
  const revisions =
    (snapshot.rows("workspaceMeta").find((row) => row.key === "revisions")?.value as
      | Record<string, number>
      | undefined) ?? {};
  return { revision: revisions.referenceCatalog ?? 0 };
}

describe("ReferenceCatalog.resolve and seedDefaults at manifest v2, at the public resolve and seedDefaults seams", () => {
  let seam: TransactionSeam;
  let database: IDBDatabase;
  let accountId: string;

  beforeEach(async () => {
    const opened = await openD2Seam();
    seam = opened.seam;
    database = opened.database;
    await seedV1(seam);
    accountId = await createAccountFixture(seam);
  });

  afterEach(async () => {
    await close(database);
  });

  it("should return the active Account and the immutable Long Stock shape as bound NewSelection values under one Catalog snapshot when both are selectable", async () => {
    const result = await resolve(seam, {
      accountId,
      strategyStableKey: LONG_STOCK,
      mode: "NewSelection",
    });

    expect(result.outcome).toBe("Resolved");
    if (result.outcome !== "Resolved") return;
    expect(result.account.id).toBe(accountId);
    expect(result.account.label).toBe("Brokerage One");
    expect(result.strategy.stableKey).toBe(LONG_STOCK);
    expect(result.strategy.shape.roles).toEqual([{ side: "long", kind: "stock", quantity: "1" }]);
    expect(result.snapshotRevision).toBe((await revision(seam)).revision);
  });

  it("should reject with a typed NewSelection issue naming the Account when the Account has been archived, and return no Strategy binding", async () => {
    const retired = await save(seam, {
      type: "retireAccount",
      id: accountId,
      expectedSnapshotRevision: (await revision(seam)).revision,
    });
    expect(retired.outcome).toBe("Saved");

    const result = await resolve(seam, {
      accountId,
      strategyStableKey: LONG_STOCK,
      mode: "NewSelection",
    });

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    expect(result.issues.map((issue) => issue.code)).toContain("AccountArchived");
    expect(result.issues.find((issue) => issue.code === "AccountArchived")?.identity).toBe(accountId);
    expect(Object.keys(result)).not.toContain("strategy");
  });

  it("should reject with a typed NewSelection issue naming the Strategy when the Long Stock Strategy has been retired", async () => {
    const rows = await seam.snapshot(["referenceCatalog"]);
    const strategyRow = rows.rows("referenceCatalog").find((row) => row.id === `strategy:${LONG_STOCK}`);
    expect(strategyRow).toBeDefined();
    await seam.commit({
      participants: [
        { store: "referenceCatalog", put: [{ ...strategyRow, retired: true, revision: 2 }] },
      ],
    });

    const result = await resolve(seam, {
      accountId,
      strategyStableKey: LONG_STOCK,
      mode: "NewSelection",
    });

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    expect(result.issues.map((issue) => issue.code)).toContain("StrategyRetired");
    expect(result.issues.find((issue) => issue.code === "StrategyRetired")?.identity).toBe(LONG_STOCK);
  });

  it("should return a snapshot conflict and no bindings when the expected Catalog snapshot is stale because the Strategy was retired between resolve and the caller's next step", async () => {
    const current = (await revision(seam)).revision;

    const rows = await seam.snapshot(["referenceCatalog"]);
    const strategyRow = rows.rows("referenceCatalog").find((row) => row.id === `strategy:${LONG_STOCK}`);
    await seam.commit({
      participants: [
        { store: "referenceCatalog", put: [{ ...strategyRow, retired: true, revision: 2 }] },
      ],
    });

    const result = await resolve(seam, {
      accountId,
      strategyStableKey: LONG_STOCK,
      mode: "NewSelection",
      expectedSnapshotRevision: current,
    });

    expect(result.outcome).toBe("SnapshotConflict");
    if (result.outcome !== "SnapshotConflict") return;
    expect(result.expected).toBe(current);
    expect(result.current).toBeGreaterThan(current);
  });

  it("should seed only the missing v2 additions and return the resulting snapshot plus the exact additions when the Workspace already holds a compatible v1 seed", async () => {
    const before = (await revision(seam)).revision;

    const result = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V2);

    expect(result.outcome).toBe("Seeded");
    if (result.outcome !== "Seeded") return;
    expect(result.seedVersion).toBe("catalog-seed-v2");
    expect(result.additions).toEqual([]);
    expect((await revision(seam)).revision).toBe(before);
    expect(result.catalog.strategies).toHaveLength(1);
    expect(result.catalog.accounts.map((account) => account.id)).toContain(accountId);
  });

  it("should create no Strategy beyond Long Stock and no Close Reason, Abandonment Reason or Tag Type when manifest v2 is applied to a v1 Workspace, asserting those absences rather than reporting them as uninstalled capability", async () => {
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V2);

    const rows = await seam.snapshot(["referenceCatalog"]);
    const kinds = rows.rows("referenceCatalog").map((row) => row.kind);
    expect(kinds.filter((kind) => kind === "strategy")).toHaveLength(1);
    expect(kinds).not.toContain("closeReason");
    expect(kinds).not.toContain("abandonmentReason");
    expect(kinds).not.toContain("tagType");
  });

  it("should return an idempotent unchanged result with no rewrite when the v2 manifest is applied twice", async () => {
    const first = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V2);
    const rowsAfterFirst = (await seam.snapshot(["referenceCatalog"])).rows("referenceCatalog");
    const second = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V2);
    const rowsAfterSecond = (await seam.snapshot(["referenceCatalog"])).rows("referenceCatalog");

    expect(first.outcome).toBe("Seeded");
    expect(second.outcome).toBe("Seeded");
    if (first.outcome !== "Seeded" || second.outcome !== "Seeded") return;
    expect(second.additions).toEqual([]);
    expect(rowsAfterSecond).toEqual(rowsAfterFirst);
  });

  it("should return a typed SeedConflict and write nothing when an existing stable product key carries an incompatible shape", async () => {
    const rows = await seam.snapshot(["referenceCatalog"]);
    const strategyRow = rows.rows("referenceCatalog").find((row) => row.id === `strategy:${LONG_STOCK}`);
    await seam.commit({
      participants: [
        {
          store: "referenceCatalog",
          put: [
            {
              ...strategyRow,
              shape: { roles: [{ side: "long", kind: "call", quantity: "1" }], constraints: [] },
            },
          ],
        },
      ],
    });
    const before = (await seam.snapshot(["referenceCatalog"])).rows("referenceCatalog");

    const result = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V2);

    expect(result.outcome).toBe("SeedConflict");
    if (result.outcome !== "SeedConflict") return;
    expect(result.stableKey).toBe(LONG_STOCK);
    expect((await seam.snapshot(["referenceCatalog"])).rows("referenceCatalog")).toEqual(before);
  });

  it("should return the Long Stock shape's one long Stock role with its positive relative quantity and no embedded days-to-expiration, delta, price, Stop, Target or quantity default when the shape is read", async () => {
    const result = await resolve(seam, {
      accountId,
      strategyStableKey: LONG_STOCK,
      mode: "NewSelection",
    });

    expect(result.outcome).toBe("Resolved");
    if (result.outcome !== "Resolved") return;
    const shape = result.strategy.shape;
    expect(shape.roles).toHaveLength(1);
    expect(Number(shape.roles[0]?.quantity)).toBeGreaterThan(0);
    const serialized = JSON.stringify(shape).toLowerCase();
    for (const forbidden of ["dte", "daystoexpiration", "delta", "price", "stop", "target"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
