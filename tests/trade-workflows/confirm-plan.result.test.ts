import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V2, seedDefaults as seedCatalog } from "../../src/catalog";
import { save } from "../../src/catalog/save";
import { SEED_MANIFEST_V2, seedDefaults as seedJournal } from "../../src/journal";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import {
  LIFECYCLE_INDEX_STORE,
  TRADE_FACT_STORE,
  TRADE_LIFECYCLE_STORE,
} from "../../src/trade-record";
import { confirmPlan, type ConfirmPlanCommand, type ConfirmPlanSuccess } from "../../src/trade-workflows";
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

async function catalogRevision(seam: TransactionSeam): Promise<number> {
  const snapshot = await seam.snapshot(["workspaceMeta"]);
  const revisions =
    (snapshot.rows("workspaceMeta").find((row) => row.key === "revisions")?.value as
      | Record<string, number>
      | undefined) ?? {};
  return revisions.referenceCatalog ?? 0;
}

describe("ConfirmPlanResult, at the public confirmPlan seam", () => {
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

  async function accepted(overrides: Partial<ConfirmPlanCommand> = {}): Promise<ConfirmPlanSuccess> {
    const result = await confirmPlan(seam, command(overrides));
    if (result.outcome !== "Accepted") {
      throw new Error(`confirmation was not accepted: ${result.outcome} ${JSON.stringify(result)}`);
    }
    return result.value;
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

  it("should return the committed Trade projection, the frozen Plan, the Planned Legs and the original management at the exact new FactRevision when the confirmation commits", async () => {
    const value = await accepted();

    const trade = value.postCommit.trades[0];
    expect(trade?.factRevision).toBe(1);
    expect(trade?.plan.intendedEntry).toEqual({ amount: "180.00" });
    expect(trade?.plan.plannedLegs).toHaveLength(1);
    expect(trade?.plan.originalManagement).toHaveLength(2);
    expect(value.receipt.newFactRevisions[TRADE_FACT_STORE]).toBe(1);
  });

  it("should return the completed Plan Reflection Entry projection including its Anchor, Source, definition snapshot and the Thesis and Invalidation answers when the confirmation commits", async () => {
    const value = await accepted();

    const entry = value.postCommit.journal[0];
    expect(entry?.anchor.kind).toBe("TradeAnchor");
    expect(entry?.sourceStableKey).toBe("source.plan-confirmation");
    expect(entry?.definitionRevision).toBe(1);
    expect(entry?.thesis).toBe("Breakout above the base");
    expect(entry?.invalidation).toBe("Closes back inside the base");
    expect(value.receipt.entryIds).toEqual([entry?.entryId]);
  });

  it("should return the accepted Plan Baseline and positive 1R as the derivation the command had to establish, bound to the same FactRevision as the committed Trade projection, when the confirmation commits", async () => {
    const value = await accepted();

    const trade = value.postCommit.trades[0];
    expect(value.postCommit.derivation.oneR).toEqual({ amount: "500", currency: "USD" });
    expect(Number(value.postCommit.derivation.oneR.amount)).toBeGreaterThan(0);
    expect(value.postCommit.derivation.planBaseline.originalPlannedRisk).toEqual(trade?.baseline.originalPlannedRisk);
    expect(value.postCommit.derivation.expectedLifecycle).toBe(trade?.lifecycle);
    expect(trade?.factRevision).toBe(value.receipt.newFactRevisions[TRADE_FACT_STORE]);
  });

  it("should return the created Trade, Plan, Planned-Leg, management and Entry identities and the Lifecycle State transition to Planned when the confirmation commits", async () => {
    const value = await accepted();

    expect(value.receipt.createdFactIds.length).toBeGreaterThanOrEqual(5);
    expect(value.receipt.lifecycleTransitions).toEqual([
      {
        tradeId: value.postCommit.trades[0]?.tradeId,
        from: "None",
        to: "Planned",
      },
    ]);
    expect(value.receipt.entryIds).toHaveLength(1);
    expect(value.receipt.debtIds).toEqual([]);
  });

  it("should be sufficient to render the saved Plan and continue the workflow without calling getRecord or any Journal query after the call, when the caller renders the committed result", async () => {
    const value = await accepted();

    // Every value the saved screen shows is present in the returned value.
    expect(value.postCommit.trades[0]?.plan.intendedEntry.amount).toBe("180.00");
    expect(value.postCommit.trades[0]?.baseline.oneR.amount).toBe("500");
    expect(value.postCommit.journal[0]?.thesis).toBeTruthy();
    expect(value.postCommit.derivation.expectedLifecycle).toBe("Planned");
    expect(value.affected.tradeIds).toEqual([value.postCommit.trades[0]?.tradeId]);
  });

  it("should not include unrelated lists, reports or other Trades, and should limit affected-scope metadata to advisory identity information, when the confirmed Trade is one of several existing Trades", async () => {
    await accepted();
    const second = await accepted({
      plan: longStockPlan({ intendedEntry: { amount: "185.00" } }),
      obligationKey: "plan-confirmation:2",
    });

    expect(second.postCommit.trades).toHaveLength(1);
    expect(second.postCommit.journal).toHaveLength(1);
    expect(second.affected.tradeIds).toHaveLength(1);
    expect(second.receipt.affectedTradeIds).toHaveLength(1);
    const keys = Object.keys(second.affected).sort();
    expect(keys).toEqual(["accountId", "strategyStableKey", "tradeIds"]);

    const all = (await seam.snapshot([TRADE_LIFECYCLE_STORE])).rows(TRADE_LIFECYCLE_STORE);
    expect(all).toHaveLength(2);
  });

  it("should return a no-write typed result that contains no Trade identity, no Entry identity and no FactRevision when the command is rejected", async () => {
    const result = await confirmPlan(
      seam,
      command({ plan: longStockPlan({ originalManagement: [] }) }),
    );

    expect(result.outcome).toBe("Rejected");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("trade:");
    expect(serialized).not.toContain("entry:");
    expect(Object.keys(result)).not.toContain("value");
    expect((await seam.snapshot([TRADE_FACT_STORE])).rows(TRADE_FACT_STORE)).toEqual([]);
    expect((await seam.snapshot([LIFECYCLE_INDEX_STORE])).rows(LIFECYCLE_INDEX_STORE)).toEqual([]);
  });

  it("should return values that equal a fresh authoritative read at the same revisions when the projection is compared after commit, so that the projection is not a synthesized approximation", async () => {
    const value = await accepted();
    const trade = value.postCommit.trades[0];

    const facts = (await seam.snapshot([TRADE_FACT_STORE])).rows(TRADE_FACT_STORE);
    const lifecycle = (await seam.snapshot([TRADE_LIFECYCLE_STORE])).rows(TRADE_LIFECYCLE_STORE);
    const header = facts.find((row) => row.kind === "trade");
    const plan = facts.find((row) => row.kind === "plan");
    const entry = (await seam.snapshot(["journal"])).rows("journal").find((row) => row.kind === "entry");

    expect(header?.accountId).toBe(trade?.accountId);
    expect(header?.economicTime).toBe(trade?.economicTime);
    expect(plan?.intendedEntry).toEqual(trade?.plan.intendedEntry);
    expect(lifecycle[0]?.factRevision).toBe(trade?.factRevision);
    expect(lifecycle[0]?.state).toBe(trade?.lifecycle);
    expect(entry?.thesis).toBe(value.postCommit.journal[0]?.thesis);
    expect(
      (plan?.baseline as { oneR?: { amount?: string } } | undefined)?.oneR?.amount,
    ).toBe(trade?.oneR.amount);
  });
});
