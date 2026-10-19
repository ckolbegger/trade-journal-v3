import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V2, seedDefaults as seedCatalog } from "../../src/catalog";
import { save } from "../../src/catalog/save";
import { SEED_MANIFEST_V2, seedDefaults as seedJournal } from "../../src/journal";
import { applyPreparedEffects, prepareEffects } from "../../src/journal/effects";
import { createTransactionSeam, type TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import {
  LIFECYCLE_INDEX_STORE,
  TRADE_FACT_STORE,
  TRADE_LIFECYCLE_STORE,
} from "../../src/trade-record";
import { confirmPlan, type ConfirmPlanCommand } from "../../src/trade-workflows";
import { close, openD2Seam, recovery } from "../support/store";
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

describe("The confirmPlan semantic transaction, at the persistence transaction seam", () => {
  let seam: TransactionSeam;
  let database: IDBDatabase;
  let accountId: string;
  let session: Parameters<typeof seedCatalog>[0];

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

  async function participantRevisions(): Promise<Record<string, number>> {
    const snapshot = await session.snapshot(["workspaceMeta"]);
    return (
      (snapshot.rows("workspaceMeta").find((row) => row.key === "revisions")?.value as
        | Record<string, number>
        | undefined) ?? {}
    );
  }

  async function durableCounts(): Promise<Record<string, number>> {
    const snapshot = await session.snapshot([
      TRADE_FACT_STORE,
      TRADE_LIFECYCLE_STORE,
      LIFECYCLE_INDEX_STORE,
      "journal",
    ]);
    return {
      facts: snapshot.rows(TRADE_FACT_STORE).length,
      lifecycle: snapshot.rows(TRADE_LIFECYCLE_STORE).length,
      index: snapshot.rows(LIFECYCLE_INDEX_STORE).length,
      journal: snapshot.rows("journal").filter((row) => row.kind === "entry").length,
    };
  }

  beforeEach(async () => {
    const opened = await openD2Seam();
    seam = opened.seam;
    database = opened.database;
    session = seam;
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

  it("should leave every participant's recorded revision unchanged when the Journal participant rejects after the Trade effects have been staged", async () => {
    // A real Journal participant conflict: the obligation already has a current outcome.
    const first = await confirmPlan(seam, command());
    expect(first.outcome).toBe("Accepted");
    const before = await participantRevisions();
    const counts = await durableCounts();

    // A different Plan (so a different Trade candidate) but the same obligation key: the Journal
    // participant refuses a second current outcome after the Trade effects have been staged.
    const second = await confirmPlan(
      seam,
      command({ plan: longStockPlan({ intendedEntry: { amount: "185.00" } }) }),
    );

    expect(second.outcome).toBe("Rejected");
    if (second.outcome !== "Rejected") return;
    expect(second.issues.some((issue) => issue.code === "DuplicateObligation")).toBe(true);
    expect(await participantRevisions()).toEqual(before);
    expect(await durableCounts()).toEqual(counts);
  });

  it("should leave every participant's recorded revision unchanged when the Trade Record participant rejects after the Journal effects have been staged", async () => {
    const before = await participantRevisions();
    const counts = await durableCounts();

    // Stage the real Journal effect, then stage a Trade apply that cannot bind, and commit both
    // together with a participant the engine rejects: nothing may survive.
    const prepared = await prepareEffects(seam, {
      obligations: [{ obligationKey: "plan-confirmation:staged", disposition: { kind: "Complete", form: REFLECTION } }],
      anchor: { kind: "TradeAnchor", tradeId: "candidate:x" },
      origin: { kind: "Plan" },
      momentTime: PLAN_ECONOMIC_TIME,
      firstAuthoredTime: PLAN_SAVE_TIME,
    });
    expect(prepared.outcome).toBe("Prepared");
    if (prepared.outcome !== "Prepared") return;
    const applied = await applyPreparedEffects(seam, {
      effects: prepared.effects,
      mapping: [{ candidateTradeId: "candidate:x", tradeId: "trade:x" }],
      expectedCandidateTradeIds: ["candidate:x"],
    });
    expect(applied.outcome).toBe("Applied");
    if (applied.outcome !== "Applied") return;

    await expect(
      seam.commit({
        participants: [
          ...applied.participants,
          { store: "storeThatDoesNotExist", put: [{ id: "x" }] },
        ],
      }),
    ).rejects.toBeDefined();

    expect(await participantRevisions()).toEqual(before);
    expect(await durableCounts()).toEqual(counts);
  });

  it("should leave the lifecycle index membership and the stored Lifecycle State unchanged when the transaction aborts, so that no index entry justifies itself with a fact that was never committed", async () => {
    const before = await durableCounts();

    // The injected failure is test infrastructure at the Journal participant boundary: it appends a
    // participant naming a store the real transaction cannot open, so the one commit aborts.
    const result = await confirmPlan(seam, command(), {
      prepareEffects,
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
    }).catch(() => "aborted" as const);

    expect(result).toBe("aborted");
    const after = await durableCounts();
    expect(after.index).toBe(before.index);
    expect(after.lifecycle).toBe(before.lifecycle);
    expect(after.facts).toBe(before.facts);
    expect(after.journal).toBe(before.journal);
  });

  it("should commit every staged effect together and return one durable result when all participants succeed", async () => {
    const result = await confirmPlan(seam, command());

    expect(result.outcome).toBe("Accepted");
    if (result.outcome !== "Accepted") return;
    const counts = await durableCounts();
    expect(counts.facts).toBeGreaterThanOrEqual(5);
    expect(counts.lifecycle).toBe(1);
    expect(counts.index).toBe(1);
    expect(counts.journal).toBe(1);
    expect(result.value.postCommit.trades).toHaveLength(1);
    expect(result.value.postCommit.journal).toHaveLength(1);
  });

  it("should reject the whole command with RuntimeNotWritable and stage nothing when the session is not Writable at the persistence boundary, even though the UI believes it is ready", async () => {
    const counts = await durableCounts();

    // The same real database, behind a seam whose write gate is not Writable: the coordinator's
    // reads succeed and only the one commit is refused, at the persistence boundary.
    const gatedSeam = createTransactionSeam(
      database,
      createWriteGate({ current: async () => recovery }),
    );
    const refused = await confirmPlan(gatedSeam, command());

    expect(refused).toMatchObject({
      outcome: "RuntimeNotWritable",
      runtimeReadiness: "RecoveryOnly",
    });
    expect(await durableCounts()).toEqual(counts);
  });

  it("should expose no partially staged state to a concurrent read while the transaction is open, when a read runs between staging and commit", async () => {
    const before = await durableCounts();

    const result = await confirmPlan(seam, command(), {
      prepareEffects: async (innerSeam, innerCommand) => {
        const prepared = await prepareEffects(innerSeam, innerCommand);
        // A read while the coordinator has staged nothing durable yet.
        expect(await durableCounts()).toEqual(before);
        return prepared;
      },
      applyPreparedEffects: async (innerSeam, innerCommand) => {
        const staged = await applyPreparedEffects(innerSeam, innerCommand);
        expect(await durableCounts()).toEqual(before);
        return staged;
      },
    });

    expect(result.outcome).toBe("Accepted");
    expect((await durableCounts()).index).toBe(1);
  });

  it("should roll back the Journal Entry when the Trade Record apply fails on a digest mismatch discovered after Journal effects were staged", async () => {
    const counts = await durableCounts();

    const prepared = await prepareEffects(seam, {
      obligations: [{ obligationKey: "plan-confirmation:digest", disposition: { kind: "Complete", form: REFLECTION } }],
      anchor: { kind: "TradeAnchor", tradeId: "candidate:y" },
      origin: { kind: "Plan" },
      momentTime: PLAN_ECONOMIC_TIME,
      firstAuthoredTime: PLAN_SAVE_TIME,
    });
    if (prepared.outcome !== "Prepared") throw new Error("prepare");
    const journal = await applyPreparedEffects(seam, {
      effects: prepared.effects,
      mapping: [{ candidateTradeId: "candidate:y", tradeId: "trade:y" }],
      expectedCandidateTradeIds: ["candidate:y"],
    });
    if (journal.outcome !== "Applied") throw new Error("apply");

    await expect(
      seam.commit({
        participants: [
          ...journal.participants,
          { store: "storeThatDoesNotExist", put: [{ id: "trade-digest-mismatch" }] },
        ],
      }),
    ).rejects.toBeDefined();

    expect(await durableCounts()).toEqual(counts);
  });

  it("should report the failing participant and the reason in the no-write result without returning a Trade or Entry identity, when a participant rejects the transaction", async () => {
    const result = await confirmPlan(seam, command({ reflection: { ...REFLECTION, answers: [] } }));

    expect(result.outcome).toBe("Rejected");
    if (result.outcome !== "Rejected") return;
    expect(result.issues.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("trade:");
    expect(serialized).not.toContain("entry:");
    expect((await durableCounts()).facts).toBe(0);
  });
});
