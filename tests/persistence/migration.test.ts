import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase, transactionDone, CANDIDATE_DATABASE_PREFIX } from "../../src/persistence/indexeddb/schema";
import { CONTROL_DATABASE_NAME, readActiveVersion, readPointer, migrate } from "../../src/persistence/indexeddb/migration";

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  const SOURCE = "trade-journal";

  afterEach(async () => {
    await deleteDatabase(CONTROL_DATABASE_NAME);
    await deleteDatabase(SOURCE);
    await deleteDatabase("trade-journal-candidate-m1");
  });

  it("should build the candidate, validate every section, and flip the active pointer only after validation when the stored schema version is one supported step behind", async () => {
      const source = await openDatabase(SOURCE, 1);
      const write = source.transaction("tradeRecord", "readwrite");
      write.objectStore("tradeRecord").put({ id: "trade-1", kind: "trade", economicTime: "2026-10-19" });
      await transactionDone(write);
      source.close();

      const result = await migrate({
        migrationId: "m1",
        targetVersion: 2,
        steps: [
          {
            id: "m1.add-settlement-field",
            fromVersion: 1,
            toVersion: 2,
            apply: (snapshot) => ({
              stores: {
                ...snapshot.stores,
                tradeRecord: (snapshot.stores.tradeRecord ?? []).map((row) => ({
                  ...row,
                  settlementKind: null,
                })),
              },
            }),
          },
        ],
        seedVersion: "seed-v1",
        seedAdditions: [],
      });

      expect(result.outcome).toBe("Migrated");

      // The source version is still present and openable at its original version.
      const stillThere = await openDatabase(SOURCE, 1);
      expect(stillThere.version).toBe(1);
      const rows = await new Promise<unknown>((resolve, reject) => {
        const request = stillThere.transaction("tradeRecord").objectStore("tradeRecord").get("trade-1");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      expect(rows).toEqual({ id: "trade-1", kind: "trade", economicTime: "2026-10-19" });
      stillThere.close();

      expect(result).toMatchObject({ activeDatabaseName: "trade-journal-candidate-m1" });
      expect(await readActiveVersion()).toBe(2);

      const pointer = await readPointer();
      expect(pointer?.databaseName).toBe("trade-journal-candidate-m1");
    });
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  const SOURCE = "trade-journal";

  const STALE = `${CANDIDATE_DATABASE_PREFIX}stale`;

  const FRESH = `${CANDIDATE_DATABASE_PREFIX}m6`;

  afterEach(async () => {
    await deleteDatabase(CONTROL_DATABASE_NAME);
    await deleteDatabase(SOURCE);
    await deleteDatabase(STALE);
    await deleteDatabase(FRESH);
  });

  it("should discard a stale candidate and leave the prior version in control when the process is interrupted after the candidate is built and before the pointer flip", async () => {
      const source = await openDatabase(SOURCE, 1);
      const write = source.transaction("tradeRecord", "readwrite");
      write.objectStore("tradeRecord").put({ id: "trade-1", kind: "trade", economicTime: "2026-10-19" });
      await transactionDone(write);
      source.close();

      // Simulate the interrupted run: a candidate exists but the pointer was never flipped.
      const stale = await openDatabase(STALE, 1);
      const staleWrite = stale.transaction("tradeRecord", "readwrite");
      staleWrite.objectStore("tradeRecord").put({ id: "trade-1", kind: "trade" });
      await transactionDone(staleWrite);
      stale.close();
      expect(await readPointer()).toBeUndefined();

      const result = await migrate({
        migrationId: "m6",
        targetVersion: 2,
        steps: [{ id: "m6.noop", fromVersion: 1, toVersion: 2, apply: (snapshot) => snapshot }],
        seedVersion: "seed-v1",
        seedAdditions: [],
      });

      expect(result.outcome).toBe("Migrated");
      const pointer = await readPointer();
      expect(pointer?.databaseName).toBe(FRESH);

      const databases = await indexedDB.databases();
      expect(databases.map((database) => database.name)).not.toContain(STALE);

      const stillThere = await openDatabase(SOURCE, 1);
      expect(stillThere.version).toBe(1);
      stillThere.close();
    });
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  const SOURCE = "trade-journal";

  const CANDIDATE = "trade-journal-candidate-m5";

  afterEach(async () => {
    await deleteDatabase(CONTROL_DATABASE_NAME);
    await deleteDatabase(SOURCE);
    await deleteDatabase(CANDIDATE);
  });

  it("should reject a conversion that cannot preserve an authoritative identity, fact, audit revision or provenance field with a typed LossyMigrationRequired and discard the candidate", async () => {
      const source = await openDatabase(SOURCE, 1);
      const write = source.transaction("tradeRecord", "readwrite");
      write.objectStore("tradeRecord").put({ id: "trade-1", kind: "trade", auditRevision: "r7" });
      await transactionDone(write);
      source.close();

      const result = await migrate({
        migrationId: "m5",
        targetVersion: 2,
        steps: [
          {
            id: "m5.drop-audit-revision",
            fromVersion: 1,
            toVersion: 2,
            apply: () => ({
              refusal: "LossyMigrationRequired",
              detail: "the audit revision cannot be preserved",
            }),
          },
        ],
        seedVersion: "seed-v1",
        seedAdditions: [],
      });

      expect(result).toMatchObject({
        outcome: "MigrationBlocked",
        reason: "LossyMigrationRequired",
        detail: "the audit revision cannot be preserved",
      });
      expect(await readPointer()).toBeUndefined();

      const unchanged = await openDatabase(SOURCE, 1);
      expect(unchanged.version).toBe(1);
      unchanged.close();

      const databases = await indexedDB.databases();
      expect(databases.map((database) => database.name)).not.toContain(CANDIDATE);
    });
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  const SOURCE = "trade-journal";

  const CANDIDATE = "trade-journal-candidate-m8";

  afterEach(async () => {
    await deleteDatabase(CONTROL_DATABASE_NAME);
    await deleteDatabase(SOURCE);
    await deleteDatabase(CANDIDATE);
  });

  it("should rebuild the private projections inside the candidate and prove recomputed index membership equals the candidate's stored membership before the flip", async () => {
      const source = await openDatabase(SOURCE, 1);
      const write = source.transaction("lifecycleIndex", "readwrite");
      write.objectStore("lifecycleIndex").put({ tradeId: "trade-1", state: "Open", cutoffTradingDate: "2026-10-19" });
      write.objectStore("lifecycleIndex").put({ tradeId: "trade-2", state: "Closed", cutoffTradingDate: "2026-10-20" });
      await transactionDone(write);
      source.close();

      const result = await migrate({
        migrationId: "m8",
        targetVersion: 2,
        steps: [{ id: "m8.noop", fromVersion: 1, toVersion: 2, apply: (snapshot) => snapshot }],
        seedVersion: "seed-v1",
        seedAdditions: [],
      });

      expect(result.outcome).toBe("Migrated");
      expect(result).toMatchObject({ receipt: { privateRebuilds: ["lifecycleListProjection"] } });

      const pointer = await readPointer();
      const candidate = await openDatabase(pointer?.databaseName ?? CANDIDATE, 2);
      const projection = await new Promise<unknown[]>((resolve, reject) => {
        const request = candidate.transaction("lifecycleListProjection").objectStore("lifecycleListProjection").getAll();
        request.onsuccess = () => resolve(request.result as unknown[]);
        request.onerror = () => reject(request.error);
      });
      candidate.close();

      expect(projection).toEqual([
        { tradeId: "trade-1", state: "Open", cutoffTradingDate: "2026-10-19" },
        { tradeId: "trade-2", state: "Closed", cutoffTradingDate: "2026-10-20" },
      ]);
    });
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  const SOURCE = "trade-journal";

  afterEach(async () => {
    await deleteDatabase(CONTROL_DATABASE_NAME);
    await deleteDatabase(SOURCE);
    await deleteDatabase("trade-journal-candidate-m9");
  });

  it("should return a migration receipt naming the schema transitions, the migrations applied, the seed versions and additions, and every private rebuild when migration succeeds", async () => {
      const source = await openDatabase(SOURCE, 1);
      const write = source.transaction("referenceCatalog", "readwrite");
      write.objectStore("referenceCatalog").put({ id: "ref-1", kind: "strategy", stableKey: "strategy.long-stock", label: "Long Stock" });
      await transactionDone(write);
      source.close();

      const result = await migrate({
        migrationId: "m9",
        targetVersion: 3,
        steps: [
          { id: "m9.step-one", fromVersion: 1, toVersion: 2, apply: (snapshot) => snapshot },
          {
            id: "m9.step-two",
            fromVersion: 2,
            toVersion: 3,
            apply: (snapshot) => ({
              stores: {
                ...snapshot.stores,
                referenceCatalog: (snapshot.stores.referenceCatalog ?? []).map((row) => ({
                  ...row,
                  label: row.label,
                })),
              },
            }),
          },
        ],
        seedVersion: "seed-v3",
        seedAdditions: [
          {
            store: "referenceCatalog",
            stableKey: "strategy.long-call",
            values: { id: "ref-2", kind: "strategy", label: "Long Call" },
          },
        ],
      });

      expect(result).toMatchObject({
        outcome: "Migrated",
        receipt: {
          migrationId: "m9",
          schemaTransitions: [{ from: 1, to: 3 }],
          migrationsApplied: ["m9.step-one", "m9.step-two"],
          seedVersion: "seed-v3",
          seedAdditions: ["strategy.long-call"],
          privateRebuilds: ["lifecycleListProjection"],
        },
      });
    });
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  const SOURCE = "trade-journal";

  const CANDIDATE = `${CANDIDATE_DATABASE_PREFIX}m2`;

  afterEach(async () => {
    await deleteDatabase(CONTROL_DATABASE_NAME);
    await deleteDatabase(SOURCE);
    await deleteDatabase(CANDIDATE);
  });

  it("should leave the prior database readable and unchanged at its original version when validation of one candidate section is made to fail", async () => {
      const source = await openDatabase(SOURCE, 1);
      const write = source.transaction("journal", "readwrite");
      write.objectStore("journal").put({ id: "entry-1", entryType: "Plan Reflection" });
      await transactionDone(write);
      source.close();

      const result = await migrate({
        migrationId: "m2",
        targetVersion: 2,
        steps: [
          {
            id: "m2.noop",
            fromVersion: 1,
            toVersion: 2,
            apply: (snapshot) => snapshot,
          },
        ],
        seedVersion: "seed-v1",
        seedAdditions: [],
        validate: () => ({ section: "journal", detail: "the journal section is incoherent" }),
      });

      expect(result).toMatchObject({
        outcome: "MigrationBlocked",
        reason: "ValidationFailed",
        detail: "journal: the journal section is incoherent",
      });
      expect(await readPointer()).toBeUndefined();

      const unchanged = await openDatabase(SOURCE, 1);
      expect(unchanged.version).toBe(1);
      const row = await new Promise<unknown>((resolve, reject) => {
        const request = unchanged.transaction("journal").objectStore("journal").get("entry-1");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      expect(row).toEqual({ id: "entry-1", entryType: "Plan Reflection" });
      unchanged.close();

      const databases = await indexedDB.databases();
      expect(databases.map((database) => database.name)).not.toContain(CANDIDATE);
    });
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  const SOURCE = "trade-journal";

  afterEach(async () => {
    await deleteDatabase(CONTROL_DATABASE_NAME);
    await deleteDatabase(SOURCE);
    await deleteDatabase("trade-journal-candidate-m7");
  });

  it("should add a new manifest default to the candidate without overwriting a trader rename when the target release introduces a seed addition", async () => {
      const source = await openDatabase(SOURCE, 1);
      const write = source.transaction("referenceCatalog", "readwrite");
      write.objectStore("referenceCatalog").put({
        id: "ref-long-stock",
        kind: "strategy",
        stableKey: "strategy.long-stock",
        label: "My Long Stock",
      });
      await transactionDone(write);
      source.close();

      const result = await migrate({
        migrationId: "m7",
        targetVersion: 2,
        steps: [{ id: "m7.noop", fromVersion: 1, toVersion: 2, apply: (snapshot) => snapshot }],
        seedVersion: "seed-v2",
        seedAdditions: [
          {
            store: "referenceCatalog",
            stableKey: "strategy.long-stock",
            values: { id: "ref-long-stock", kind: "strategy", label: "Long Stock" },
          },
          {
            store: "referenceCatalog",
            stableKey: "strategy.long-call",
            values: { id: "ref-long-call", kind: "strategy", label: "Long Call" },
          },
        ],
      });

      expect(result.outcome).toBe("Migrated");
      expect(result).toMatchObject({ receipt: { seedVersion: "seed-v2", seedAdditions: ["strategy.long-call"] } });

      const pointer = await readPointer();
      expect(pointer?.databaseName).toBe("trade-journal-candidate-m7");
      const candidate = await openDatabase("trade-journal-candidate-m7", 2);
      const rows = await new Promise<unknown[]>((resolve, reject) => {
        const request = candidate.transaction("referenceCatalog").objectStore("referenceCatalog").getAll();
        request.onsuccess = () => resolve(request.result as unknown[]);
        request.onerror = () => reject(request.error);
      });
      candidate.close();

      expect(rows).toContainEqual({
        id: "ref-long-stock",
        kind: "strategy",
        stableKey: "strategy.long-stock",
        label: "My Long Stock",
      });
      expect(rows).toContainEqual({
        id: "ref-long-call",
        kind: "strategy",
        stableKey: "strategy.long-call",
        label: "Long Call",
      });
      expect(rows).toHaveLength(2);
    });
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  const SOURCE = "trade-journal";

  afterEach(async () => {
    await deleteDatabase(CONTROL_DATABASE_NAME);
    await deleteDatabase(SOURCE);
  });

  it("should reject an unknown newer stored version with a typed UnsupportedVersion naming both versions and write nothing", async () => {
      const source = await openDatabase(SOURCE, 3);
      const write = source.transaction("tradeRecord", "readwrite");
      write.objectStore("tradeRecord").put({ id: "trade-1", kind: "trade", economicTime: "2026-10-19" });
      await transactionDone(write);
      source.close();

      const result = await migrate({
        migrationId: "m3",
        targetVersion: 2,
        steps: [{ id: "m3.unused", fromVersion: 3, toVersion: 2, apply: (snapshot) => snapshot }],
        seedVersion: "seed-v1",
        seedAdditions: [],
      });

      expect(result).toEqual({
        outcome: "UnsupportedVersion",
        storedVersion: 3,
        targetVersion: 2,
        activeDatabaseName: SOURCE,
      });
      expect(await readPointer()).toBeUndefined();
    });
});
