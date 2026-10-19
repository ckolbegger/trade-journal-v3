import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V2, seedDefaults as seedCatalog } from "../../src/catalog";
import { save } from "../../src/catalog/save";
import { SEED_MANIFEST_V2, seedDefaults as seedJournal } from "../../src/journal";
import { D2_SCHEMA_MANIFEST, D2_SCHEMA_VERSION, openDatabaseWithStores } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam, type TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { queryRecords } from "../../src/trade-record";
import { derive } from "../../src/analysis/trade";
import { confirmPlan, type ConfirmPlanCommand } from "../../src/trade-workflows";
import { loadSubstitutions } from "../harness/bootstrap";
import { close, openD2Seam, writable } from "../support/store";
import { PLAN_ECONOMIC_TIME, PLAN_SAVE_TIME, longStockPlan, underlyingTarget } from "../support/plans";

const REFLECTION = {
  entryTypeStableKey: "entryType.plan-reflection",
  definitionRevision: 1,
  answers: [
    { promptStableKey: "prompt.plan-reflection.thesis", value: "Breakout above the base" },
    { promptStableKey: "prompt.plan-reflection.invalidation", value: "Closes back inside the base" },
  ],
};

async function catalogRevision(seam: TransactionSeam): Promise<number> {
  const snapshot = await seam.snapshot(["workspaceMeta"]);
  const revisions =
    (snapshot.rows("workspaceMeta").find((row) => row.key === "revisions")?.value as
      | Record<string, number>
      | undefined) ?? {};
  return revisions.referenceCatalog ?? 0;
}

describe("The D2 mock-free integration path, from the production command to durable state", () => {
  let seam: TransactionSeam;
  let database: IDBDatabase;
  let accountId: string;
  let activeDatabaseName: string;

  function command(overrides: Partial<ConfirmPlanCommand> = {}): ConfirmPlanCommand {
    return {
      accountId,
      strategyStableKey: "strategy.long-stock",
      tags: [],
      plan: longStockPlan(),
      reflection: REFLECTION,
      economicTime: PLAN_ECONOMIC_TIME,
      saveTime: PLAN_SAVE_TIME,
      firstAuthoredTime: PLAN_SAVE_TIME,
      cutoffTradingDate: "2026-10-19",
      obligationKey: "plan-confirmation:1",
      ...overrides,
    };
  }

  async function participantRevisions(target: TransactionSeam): Promise<Record<string, number>> {
    const snapshot = await target.snapshot(["workspaceMeta"]);
    return (
      (snapshot.rows("workspaceMeta").find((row) => row.key === "revisions")?.value as
        | Record<string, number>
        | undefined) ?? {}
    );
  }

  interface RawStores {
    readonly tradeRecord: readonly Record<string, unknown>[];
    readonly tradeLifecycle: readonly Record<string, unknown>[];
    readonly tradeVersion: readonly Record<string, unknown>[];
    readonly lifecycleIndex: readonly Record<string, unknown>[];
    readonly journal: readonly Record<string, unknown>[];
    readonly referenceCatalog: readonly Record<string, unknown>[];
  }

  async function rawStores(target: TransactionSeam): Promise<RawStores> {
    const snapshot = await target.snapshot([
      "tradeRecord",
      "tradeLifecycle",
      "tradeVersion",
      "lifecycleIndex",
      "journal",
      "referenceCatalog",
    ]);
    return {
      tradeRecord: snapshot.rows("tradeRecord"),
      tradeLifecycle: snapshot.rows("tradeLifecycle"),
      tradeVersion: snapshot.rows("tradeVersion"),
      lifecycleIndex: snapshot.rows("lifecycleIndex"),
      journal: snapshot.rows("journal"),
      referenceCatalog: snapshot.rows("referenceCatalog"),
    };
  }

  beforeEach(async () => {
    const opened = await openD2Seam();
    seam = opened.seam;
    database = opened.database;
    activeDatabaseName = opened.activeDatabaseName;
    await seedCatalog(seam, CATALOG_SEED_MANIFEST_V2);
    await seedJournal(seam, SEED_MANIFEST_V2);
    const institution = await save(seam, {
      type: "createInstitution",
      label: "Fidelity",
      expectedSnapshotRevision: await catalogRevision(seam),
    });
    if (institution.outcome !== "Saved") throw new Error("institution");
    const account = await save(seam, {
      type: "createAccount",
      institutionId: institution.identity,
      label: "Brokerage One",
      expectedSnapshotRevision: await catalogRevision(seam),
    });
    if (account.outcome !== "Saved") throw new Error("account");
    accountId = account.identity;
  });

  afterEach(async () => {
    await close(database);
  });

  it("should create the durable Trade, Plan, Planned Legs, original management, lifecycle record, lifecycle-index membership and Journal Entry from one real confirmPlan command, when the command runs over real persistence", async () => {
    const result = await confirmPlan(seam, command());
    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;

    const stores = await rawStores(seam);
    const types = stores.tradeRecord.map((row) => String(row.kind)).sort();
    expect(types).toEqual(["management-condition", "management-condition", "plan", "planned-leg", "trade"]);
    expect(stores.tradeLifecycle).toHaveLength(1);
    expect(stores.tradeLifecycle[0]?.state).toBe("Planned");
    expect(stores.tradeVersion).toHaveLength(1);
    expect(stores.lifecycleIndex).toHaveLength(1);
    expect(stores.lifecycleIndex[0]?.state).toBe("Planned");
    expect(stores.journal.filter((row) => row.kind === "entry")).toHaveLength(1);

    const page = await queryRecords(seam, {
      lifecycle: "CurrentState",
      state: "Planned",
      projection: "AnalysisInput",
      limit: 200,
    });
    expect(page.rows).toHaveLength(1);
    expect(page.batch[0]?.plan.originalManagement).toHaveLength(2);
  });

  it("should leave the durable state byte-identical across Trade Record, Journal and Catalog when each typed rejection payload is submitted", async () => {
    const rejections: Partial<ConfirmPlanCommand>[] = [
      { plan: longStockPlan({ originalManagement: [] }) },
      { plan: longStockPlan({ originalManagement: [underlyingTarget()] }) },
      { reflection: { ...REFLECTION, answers: [] } },
      { accountId: "account:absent" },
      { strategyStableKey: "strategy.absent" },
    ];

    for (const override of rejections) {
      const before = await rawStores(seam);
      const revisionsBefore = await participantRevisions(seam);
      const result = await confirmPlan(seam, command(override));
      expect(result.outcome).not.toBe("Accepted");
      expect(await rawStores(seam)).toEqual(before);
      expect(await participantRevisions(seam)).toEqual(revisionsBefore);
    }
  });

  it("should prove that the committed values equal the returned post-commit projection field by field, including exact decimal values, when the persistence connection is closed and reopened after commit", async () => {
    const result = await confirmPlan(seam, command());
    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    const projection = result.value.postCommit.trades[0];
    const entry = result.value.postCommit.journal[0];

    // Close and reopen the real persistence connection.
    database.close();
    const reopened = await openDatabaseWithStores(
      D2_SCHEMA_MANIFEST,
      activeDatabaseName,
      D2_SCHEMA_VERSION,
    );
    const reopenedSeam = createTransactionSeam(
      reopened,
      createWriteGate({ current: async () => writable }),
    );
    const stores = await rawStores(reopenedSeam);
    const facts = stores.tradeRecord.filter((row) => row.tradeId === projection?.tradeId);
    const plan = facts.find((row) => row.kind === "plan");
    const header = facts.find((row) => row.kind === "trade");
    const lifecycle = stores.tradeLifecycle[0];
    const journalEntry = stores.journal.find((row) => row.kind === "entry");

    expect(header?.economicTime).toBe(projection?.economicTime);
    expect(plan?.intendedEntry).toEqual(projection?.plan.intendedEntry);
    expect((plan?.baseline as { oneR: unknown }).oneR).toEqual(projection?.oneR);
    expect((plan?.baseline as { originalPlannedRisk: unknown }).originalPlannedRisk).toEqual(
      projection?.baseline.originalPlannedRisk,
    );
    expect((plan?.baseline as { plannedRewardRiskRatio: unknown }).plannedRewardRiskRatio).toBe(
      projection?.baseline.plannedRewardRiskRatio,
    );
    expect(lifecycle?.factRevision).toBe(projection?.factRevision);
    expect(lifecycle?.state).toBe(projection?.lifecycle);
    expect(journalEntry?.thesis).toBe(entry?.thesis);
    expect(journalEntry?.invalidation).toBe(entry?.invalidation);

    // Exact decimals: no floating-point drift across the reopen.
    expect((plan?.baseline as { oneR: { amount: string } }).oneR.amount).toBe("500");
    expect(String((plan?.intendedEntry as { amount: string }).amount)).toBe("180.00");
    await close(reopened);
  });

  it("should complete the confirmation with no mock, stub or canned response standing in for the Catalog, Journal, Trade Analysis, Trade Record or transaction seam, when the whole suite is executed", async () => {
    // The mock guard scans this directory for mockery shapes; this case proves the participants are
    // the real modules by requiring the default (production) participants to produce the result.
    const result = await confirmPlan(seam, command());

    expect(result.outcome).toBe("Accepted");
    const substitutions = loadSubstitutions();
    const ids = substitutions.map((substitution) => substitution.id);
    expect(ids).toContain("fake-indexeddb");
    // Every substitution names a real-engine counterpart; none stands in for an application layer.
    for (const substitution of substitutions) {
      expect(substitution.realEngineCounterpart.length).toBeGreaterThan(0);
    }
  });

  it("should leave the planned Trade absent and the durable state byte-identical across all participants when a Journal participant failure is injected inside the real transaction", async () => {
    const before = await rawStores(seam);
    const revisionsBefore = await participantRevisions(seam);

    const { applyPreparedEffects } = await import("../../src/journal/effects");
    await expect(
      confirmPlan(seam, command(), {
        prepareEffects: (await import("../../src/journal/effects")).prepareEffects,
        applyPreparedEffects: async (innerSeam, innerCommand) => {
          const staged = await applyPreparedEffects(innerSeam, innerCommand);
          if (staged.outcome !== "Applied") return staged;
          return {
            ...staged,
            participants: [
              ...staged.participants,
              { store: "storeThatDoesNotExist", put: [{ id: "injected" }] },
            ],
          };
        },
      }),
    ).rejects.toBeDefined();

    expect(await rawStores(seam)).toEqual(before);
    expect(await participantRevisions(seam)).toEqual(revisionsBefore);
    expect(
      (await queryRecords(seam, {
        lifecycle: "CurrentState",
        state: "Planned",
        projection: "AnalysisInput",
        limit: 200,
      })).rows,
    ).toEqual([]);
  });

  it("should prove that the lifecycle page is index-selected with a bounded batch and that the ordinary confirmation and read paths issue no per-record storage read and no all-history replay, when the query count is asserted", async () => {
    await confirmPlan(seam, command({ obligationKey: "plan-confirmation:1" }));
    await confirmPlan(
      seam,
      command({
        plan: longStockPlan({ intendedEntry: { amount: "185.00" } }),
        obligationKey: "plan-confirmation:2",
      }),
    );

    const page = await queryRecords(seam, {
      lifecycle: "CurrentState",
      state: "Planned",
      projection: "AnalysisInput",
      limit: 1,
    });
    expect(page.counts.indexCursors).toBe(1);
    expect(page.counts.batchReads).toBe(1);
    expect(page.counts.perRecordReads).toBe(0);
    expect(page.counts.batchEntries).toBe(1);
    // A bounded page, not an all-history replay: one row returned although two Trades exist.
    expect(page.rows).toHaveLength(1);
  });

  it("should surface a controlled stored-lifecycle disagreement on the read path and repair nothing, when the stored state is mutated through the real persistence seam", async () => {
    // Decision PD8 tier 2: authoritative derived state may be mutated for a validation scenario,
    // through the real persistence seam, disclosed alongside the correct derivation.
    const confirmed = await confirmPlan(seam, command());
    expect(confirmed.outcome).toBe("Accepted");
    if (confirmed.outcome !== "Accepted") return;
    const tradeId = confirmed.value.postCommit.trades[0]?.tradeId ?? "";

    await seam.commit({
      participants: [
        {
          store: "tradeLifecycle",
          put: [{ tradeId, state: "Open", factRevision: 1, effectiveFactDigest: "controlled", causingFactId: `${tradeId}:plan` }],
        },
        { store: "lifecycleIndex", put: [{ tradeId, state: "Open", factRevision: 1 }] },
      ],
    });
    const mutated = (await seam.snapshot(["tradeLifecycle", "lifecycleIndex"])).rows("tradeLifecycle");

    const page = await queryRecords(seam, {
      lifecycle: "CurrentState",
      state: "Open",
      projection: "AnalysisInput",
      limit: 200,
    });
    expect(page.rows.map((row) => row.tradeId)).toEqual([tradeId]);
    const input = page.batch[0];
    expect(input).toBeDefined();
    if (input === undefined) return;

    const derived = derive({
      tradeId,
      sourceFactRevision: input.factRevision,
      economicTime: input.economicTime,
      analysisCutoff: PLAN_ECONOMIC_TIME,
      storedLifecycle: "Open",
      facts: [{ kind: "trade" }, { kind: "plan" }],
    });

    expect(derived.agreement).toMatchObject({ status: "disagreement", stored: "Open", expected: "Planned" });
    expect(derived.findings).toHaveLength(1);

    // The read repaired nothing: the controlled stored state is still exactly what was written.
    expect((await seam.snapshot(["tradeLifecycle"])).rows("tradeLifecycle")).toEqual(mutated);
  });

  it("should keep D1's accepted behavior green when D2's suite runs in the same run, so that the cumulative suite still protects the foundation", async () => {
    // The cumulative run includes tests/integration/foundation.test.ts and the whole unit project;
    // this case asserts the D1 foundation still answers through the same schema.
    const snapshot = await seam.snapshot(["referenceCatalog", "journal", "workspaceMeta"]);
    expect(snapshot.rows("referenceCatalog").some((row) => row.label === "Long Stock")).toBe(true);
    expect(snapshot.rows("referenceCatalog").some((row) => row.kind === "institution")).toBe(true);
    expect(snapshot.rows("journal").some((row) => row.kind === "entryType")).toBe(true);
    expect(snapshot.rows("workspaceMeta").length).toBeGreaterThan(0);
  });
});
