import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V2, seedDefaults as seedCatalog } from "../../src/catalog";
import { save } from "../../src/catalog/save";
import { SEED_MANIFEST_V2, seedDefaults as seedJournal } from "../../src/journal";
import { D2_SCHEMA_MANIFEST } from "../../src/persistence/indexeddb/schema";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import type { PreviewPlanCommand } from "../../src/trade-workflows";
import { confirmPlan, previewPlan } from "../../src/trade-workflows";
import type { TradePlanInput } from "../../src/plan";
import { close, openD2Seam } from "../support/store";
import { PLAN_ECONOMIC_TIME, PLAN_SAVE_TIME, longStockPlan } from "../support/plans";

const REFLECTION = {
  entryTypeStableKey: "entryType.plan-reflection",
  definitionRevision: 1,
  answers: [
    { promptStableKey: "prompt.plan-reflection.thesis", value: "Breakout above the base" },
    { promptStableKey: "prompt.plan-reflection.invalidation", value: "Closes back inside the base" },
  ],
};

const STORES = D2_SCHEMA_MANIFEST.map((store) => store.name);

/**
 * The same canonical long stock Plan with no supplied monetary boundary: the shape the form
 * supplies after E-013, where Trade Analysis derives `|boundary - entry| x quantity`.
 */
function derivableDraft(): TradePlanInput {
  const plan = longStockPlan();
  return {
    ...plan,
    originalManagement: plan.originalManagement.map((condition) =>
      condition.kind === "UnderlyingPrice"
        ? {
            conditionId: condition.conditionId,
            kind: "UnderlyingPrice" as const,
            role: condition.role,
            boundaryPrice: condition.boundaryPrice,
            basis: condition.basis,
          }
        : condition,
    ),
  };
}

describe("TradeWorkflows.previewPlan and the shared assess-and-derive step, at the public previewPlan seam", () => {
  let seam: TransactionSeam;
  let database: IDBDatabase;
  let accountId: string;

  function command(overrides: Partial<PreviewPlanCommand> = {}): PreviewPlanCommand {
    return {
      accountId,
      strategyStableKey: "strategy.long-stock",
      tags: [],
      plan: derivableDraft(),
      reflection: REFLECTION,
      economicTime: PLAN_ECONOMIC_TIME,
      obligationKey: "plan-confirmation:1",
      ...overrides,
    };
  }

  async function revisions(): Promise<Record<string, number>> {
    const snapshot = await seam.snapshot(["workspaceMeta"]);
    return (
      (snapshot.rows("workspaceMeta").find((row) => row.key === "revisions")?.value as
        | Record<string, number>
        | undefined) ?? {}
    );
  }

  async function stores(): Promise<Record<string, readonly unknown[]>> {
    const snapshot = await seam.snapshot(STORES);
    return Object.fromEntries(STORES.map((name) => [name, snapshot.rows(name)]));
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
      expectedSnapshotRevision: await revisions().then((current) => current.referenceCatalog ?? 0),
    });
    if (institution.outcome !== "Saved") throw new Error("institution");
    const account = await save(seam, {
      type: "createAccount",
      institutionId: institution.identity,
      label: "Brokerage One",
      expectedSnapshotRevision: (await revisions()).referenceCatalog ?? 0,
    });
    if (account.outcome !== "Saved") throw new Error("account");
    accountId = account.identity;
  });

  afterEach(async () => {
    await close(database);
  });

  it("should return the accepted Plan Baseline, the positive 1R and the per-condition basis for a complete draft, when the Account and Strategy resolve and the Plan is complete", async () => {
    const result = await previewPlan(seam, command());

    expect(result.outcome).toBe("Previewed");
    if (result.outcome !== "Previewed") return;
    expect(result.value.planBaseline.originalPlannedRisk).toEqual({ amount: "500", currency: "USD" });
    expect(result.value.planBaseline.originalPlannedReward).toEqual({
      amount: "1000",
      currency: "USD",
    });
    expect(result.value.planBaseline.plannedRewardRiskRatio).toBe("2");
    expect(result.value.oneR).toEqual({ amount: "500", currency: "USD" });
    // No monetary boundary was supplied: Trade Analysis derived each one from its boundary price.
    expect(result.value.perConditionBasis.map((basis) => basis.monetaryBoundary)).toEqual([
      { amount: "500", currency: "USD" },
      { amount: "1000", currency: "USD" },
    ]);
  });

  it("should return the typed issues the confirmation would return and write nothing, when the draft omits the intended entry, every management condition and the leg evidence", async () => {
    const before = { stores: await stores(), revisions: await revisions() };

    const result = await previewPlan(
      seam,
      command({
        plan: {
          intendedEntry: { amount: "" },
          plannedLegs: [
            {
              legId: "leg-1",
              instrument: { instrumentKey: "AAPL", instrumentClass: "stock" },
              side: "long",
              quantity: { amount: "100", instrumentClass: "stock" },
            },
          ],
          originalManagement: [],
        },
      }),
    );

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("MissingIntendedEntry");
    expect(codes).toContain("NoManagementCoverage");
    expect(codes).toContain("MissingContractEvidence");
    expect(await stores()).toEqual(before.stores);
    expect(await revisions()).toEqual(before.revisions);
  });

  it("should return a Catalog snapshot conflict rather than a preview, when the expected snapshot moved after the form was loaded", async () => {
    const loadedAt = (await revisions()).referenceCatalog ?? 0;
    const created = await save(seam, {
      type: "createInstitution",
      label: "Schwab",
      expectedSnapshotRevision: loadedAt,
    });
    expect(created.outcome).toBe("Saved");

    const result = await previewPlan(seam, command({ expectedCatalogSnapshotRevision: loadedAt }));

    expect(result.outcome).toBe("Conflict");
    if (result.outcome !== "Conflict") return;
    expect(result.issues.map((issue) => issue.code)).toContain("CatalogSnapshotConflict");
    expect(result.currentCatalogSnapshotRevision).toBeGreaterThan(loadedAt);
  });

  it("should return a baseline identical to the one the confirmation freezes for the same draft and the same inputs, so a previewed figure can never differ from the stored one", async () => {
    const preview = await previewPlan(seam, command());
    expect(preview.outcome).toBe("Previewed");
    if (preview.outcome !== "Previewed") return;

    const confirmed = await confirmPlan(seam, {
      ...command(),
      saveTime: PLAN_SAVE_TIME,
      firstAuthoredTime: PLAN_SAVE_TIME,
      cutoffTradingDate: "2026-10-19",
    });

    expect(confirmed.outcome).toBe("Accepted");
    if (confirmed.outcome !== "Accepted") return;
    expect(confirmed.value.postCommit.derivation.planBaseline).toEqual(preview.value.planBaseline);
    expect(confirmed.value.postCommit.derivation.oneR).toEqual(preview.value.oneR);
    expect(confirmed.value.postCommit.derivation.planBaseline.perConditionBasis).toEqual(
      preview.value.perConditionBasis,
    );
  });

  it("should name the Planned Leg quantity and write nothing, when a boundary price is supplied but the leg quantity is blank, so a preview of a half-typed form never throws", async () => {
    const before = { stores: await stores(), revisions: await revisions() };
    const draft = derivableDraft();

    const result = await previewPlan(
      seam,
      command({
        plan: {
          ...draft,
          plannedLegs: draft.plannedLegs.map((leg) => ({
            ...leg,
            quantity: { amount: "", instrumentClass: "stock" },
          })),
        },
      }),
    );

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    const issue = result.issues.find((candidate) => candidate.code === "NonPositiveQuantity");
    expect(issue?.field).toBe("plan.plannedLegs[0].quantity");
    expect(await stores()).toEqual(before.stores);
    expect(await revisions()).toEqual(before.revisions);
  });

  it("should leave every store and every participant revision unchanged, when a preview is taken", async () => {
    const before = { stores: await stores(), revisions: await revisions() };

    const result = await previewPlan(seam, command());
    expect(result.outcome).toBe("Previewed");

    expect(await stores()).toEqual(before.stores);
    expect(await revisions()).toEqual(before.revisions);
  });

  it('should name the required Plan Reflection prompt from the exact definition revision supplied, when the draft\'s reflection is incomplete', async () => {
    const result = await previewPlan(
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
    expect(
      result.issues.some(
        (issue) => issue.promptStableKey === "prompt.plan-reflection.invalidation",
      ),
    ).toBe(true);
  });
});
