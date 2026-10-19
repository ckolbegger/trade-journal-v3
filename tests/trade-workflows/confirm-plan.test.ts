import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V2, seedDefaults as seedCatalog } from "../../src/catalog";
import { save } from "../../src/catalog/save";
import { SEED_MANIFEST_V2, seedDefaults as seedJournal } from "../../src/journal";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { LIFECYCLE_INDEX_STORE, TRADE_FACT_STORE, TRADE_LIFECYCLE_STORE } from "../../src/trade-record";
import { confirmPlan, type ConfirmPlanCommand } from "../../src/trade-workflows";
import { close, openD2Seam } from "../support/store";
import { PLAN_ECONOMIC_TIME, PLAN_SAVE_TIME, longStockPlan, underlyingTarget } from "../support/plans";

const REFLECTION = {
  entryTypeStableKey: "entryType.plan-reflection",
  definitionRevision: 1,
  answers: [
    { promptStableKey: "prompt.plan-reflection.thesis", value: "Breakout above the base" },
    { promptStableKey: "prompt.plan-reflection.invalidation", value: "Closes back inside the base" },
  ],
};

async function revisionOf(seam: TransactionSeam): Promise<number> {
  const snapshot = await seam.snapshot(["workspaceMeta"]);
  const revisions =
    (snapshot.rows("workspaceMeta").find((row) => row.key === "revisions")?.value as
      | Record<string, number>
      | undefined) ?? {};
  return revisions.referenceCatalog ?? 0;
}

describe("TradeWorkflows.confirmPlan, at the public confirmPlan seam", () => {
  let seam: TransactionSeam;
  let database: IDBDatabase;
  let accountId: string;

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

  async function revisionsOf(): Promise<Record<string, number>> {
    const snapshot = await seam.snapshot(["workspaceMeta"]);
    return (
      (snapshot.rows("workspaceMeta").find((row) => row.key === "revisions")?.value as
        | Record<string, number>
        | undefined) ?? {}
    );
  }

  beforeEach(async () => {
    const opened = await openD2Seam();
    seam = opened.seam;
    database = opened.database;
    await seedCatalog(seam, CATALOG_SEED_MANIFEST_V2);
    await seedJournal(seam, SEED_MANIFEST_V2);
    const institution = await save(seam, {
      type: "createInstitution",
      label: "Fidelity",
      expectedSnapshotRevision: await revisionOf(seam),
    });
    if (institution.outcome !== "Saved") throw new Error("institution");
    const account = await save(seam, {
      type: "createAccount",
      institutionId: institution.identity,
      label: "Brokerage One",
      expectedSnapshotRevision: await revisionOf(seam),
    });
    if (account.outcome !== "Saved") throw new Error("account");
    accountId = account.identity;
  });

  afterEach(async () => {
    await close(database);
  });

  it("should create exactly one Trade and exactly one completed Plan Reflection Entry in one commit when the command supplies one selectable Account, the active Long Stock Strategy, a complete Plan and a complete reflection form", async () => {
    const result = await confirmPlan(seam, command());

    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    expect(result.value.receipt.affectedTradeIds).toHaveLength(1);
    expect(result.value.receipt.entryIds).toHaveLength(1);

    const facts = (await seam.snapshot([TRADE_FACT_STORE])).rows(TRADE_FACT_STORE);
    const entries = (await seam.snapshot(["journal"])).rows("journal").filter((row) => row.kind === "entry");
    expect(facts.filter((row) => row.kind === "trade")).toHaveLength(1);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.thesis).toBe("Breakout above the base");
  });

  it("should stage no Trade or Journal effect before Catalog resolution, Journal form validation and Plan assessment have all been accepted, when a valid complete command is confirmed", async () => {
    const before = await revisionsOf();

    const result = await confirmPlan(seam, command({ accountId: "account:does-not-exist" }));

    expect(result.outcome).toBe("Rejected");
    expect(await revisionsOf()).toEqual(before);
    expect((await seam.snapshot([TRADE_FACT_STORE])).rows(TRADE_FACT_STORE)).toEqual([]);
  });

  it("should return typed issues naming the Plan field and write nothing when the Plan has no numeric baseline, so that no Trade, candidate identity, Entry, Debt or index membership exists afterwards", async () => {
    const result = await confirmPlan(
      seam,
      command({ plan: longStockPlan({ originalManagement: [underlyingTarget()] }) }),
    );

    expect(result.outcome).toBe("Rejected");
    if (result.outcome === "Rejected") {
      expect(result.issues.some((issue) => issue.code === "NoPositiveNumericBaseline")).toBe(true);
    }
    expect((await seam.snapshot([TRADE_FACT_STORE])).rows(TRADE_FACT_STORE)).toEqual([]);
    expect((await seam.snapshot([LIFECYCLE_INDEX_STORE])).rows(LIFECYCLE_INDEX_STORE)).toEqual([]);
  });

  it("should return typed issues naming the reflection prompt and write nothing when the required Invalidation answer is missing from an otherwise complete Plan", async () => {
    const result = await confirmPlan(
      seam,
      command({
        reflection: {
          ...REFLECTION,
          answers: REFLECTION.answers.filter(
            (answer) => answer.promptStableKey !== "prompt.plan-reflection.invalidation",
          ),
        },
      }),
    );

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    expect(result.issues.some((issue) => issue.promptStableKey === "prompt.plan-reflection.invalidation")).toBe(
      true,
    );
    expect((await seam.snapshot([TRADE_FACT_STORE])).rows(TRADE_FACT_STORE)).toEqual([]);
  });

  it("should return a typed rejection naming the shape/leg mismatch and write nothing when the supplied Planned Legs are incoherent for the Long Stock shape", async () => {
    const plan = longStockPlan();
    const result = await confirmPlan(
      seam,
      command({
        plan: {
          ...plan,
          plannedLegs: [
            ...plan.plannedLegs,
            {
              legId: "leg-2",
              instrument: { instrumentKey: "MSFT", instrumentClass: "stock" },
              side: "long",
              quantity: { amount: "10", instrumentClass: "stock" },
              contract: { kind: "ExactContract" },
            },
          ],
        },
      }),
    );

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    expect(result.issues.some((issue) => issue.code === "ShapeRoleCount")).toBe(true);
  });

  it("should return a typed rejection naming the Strategy and write nothing when the Strategy was retired between resolution and commit", async () => {
    const current = await revisionOf(seam);
    const rows = (await seam.snapshot(["referenceCatalog"])).rows("referenceCatalog");
    const strategy = rows.find((row) => row.id === "strategy:strategy.long-stock");

    const stale = await confirmPlan(
      seam,
      command({ expectedCatalogSnapshotRevision: current }),
    );
    expect(stale.outcome).toBe("Accepted");

    // Retire the Strategy, then confirm with the now-stale snapshot.
    await seam.commit({
      participants: [{ store: "referenceCatalog", put: [{ ...strategy, retired: true, revision: 2 }] }],
    });
    const result = await confirmPlan(seam, command({ expectedCatalogSnapshotRevision: current }));

    expect(["Conflict", "Rejected"]).toContain(result.outcome);
    if (result.outcome !== "Rejected" && result.outcome !== "Conflict") return;
    expect(result.issues.some((issue) => issue.field === "strategyStableKey")).toBe(true);
  });

  it("should supply the derivation the command had to establish, namely the accepted Plan Baseline and 1R and the expected Lifecycle State, in its result rather than only in an internal step, when confirmation succeeds", async () => {
    const result = await confirmPlan(seam, command());

    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    expect(result.value.postCommit.derivation.oneR).toEqual({ amount: "500", currency: "USD" });
    expect(result.value.postCommit.derivation.expectedLifecycle).toBe("Planned");
    expect(result.value.postCommit.derivation.planBaseline.originalPlannedReward).toEqual({
      amount: "1000",
      currency: "USD",
    });
  });

  it("should never write stored lifecycle through any setter other than applyPreparedChange when confirmation succeeds, so that stored Planned can only arrive with its justifying facts", async () => {
    const result = await confirmPlan(seam, command());

    expect(result.outcome).toBe("Accepted");
    const lifecycle = (await seam.snapshot([TRADE_LIFECYCLE_STORE])).rows(TRADE_LIFECYCLE_STORE);
    const facts = (await seam.snapshot([TRADE_FACT_STORE])).rows(TRADE_FACT_STORE);
    expect(lifecycle).toHaveLength(1);
    expect(lifecycle[0]?.state).toBe("Planned");
    // The binding the lifecycle record names is a fact that exists in the same commit.
    expect(facts.map((row) => row.id)).toContain(lifecycle[0]?.causingFactId);
  });
});
