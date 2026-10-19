import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import {
  LIFECYCLE_INDEX_STORE,
  TRADE_FACT_STORE,
  TRADE_LIFECYCLE_STORE,
  applyPreparedChange,
} from "../../src/trade-record";
import { close, openD2Seam } from "../support/store";
import { applyFixture, confirmFixture } from "../support/confirm";
import { PLAN_SAVE_TIME } from "../support/plans";

describe("TradeRecord.applyPreparedChange for a prepared Confirm Plan candidate, at the public applyPreparedChange seam inside a coordinator transaction", () => {
  let seam: TransactionSeam;
  let database: IDBDatabase;

  beforeEach(async () => {
    const opened = await openD2Seam();
    seam = opened.seam;
    database = opened.database;
  });

  afterEach(async () => {
    await close(database);
  });

  it("should assign durable Trade, Plan, Planned-Leg and management identities and return them in the identity mapping when the prepared candidate is applied with a reconciliation bound to the exact candidate set", async () => {
    const applied = await applyFixture(seam);

    expect(applied.outcome).toBe("Staged");
    if (applied.outcome !== "Staged") return;
    const mapping = applied.identityMapping[0];
    expect(mapping?.tradeId.startsWith("trade:")).toBe(true);
    expect(mapping?.factIds.plan).toContain(mapping?.tradeId ?? "");
    expect(mapping?.legIds).toHaveLength(1);
    expect(mapping?.conditionIds).toHaveLength(2);
  });

  it("should stage stored Lifecycle State as Planned with its effective-fact digest, causing fact and FactRevision binding when the candidate creates a new Trade with no position-changing fact", async () => {
    const applied = await applyFixture(seam);
    expect(applied.outcome).toBe("Staged");
    if (applied.outcome !== "Staged") return;
    await seam.commit({ participants: applied.participants });

    const rows = (await seam.snapshot([TRADE_LIFECYCLE_STORE])).rows(TRADE_LIFECYCLE_STORE);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe("Planned");
    expect(typeof rows[0]?.effectiveFactDigest).toBe("string");
    expect(String(rows[0]?.causingFactId)).toContain(":plan");
    expect(rows[0]?.factRevision).toBe(1);

    const index = (await seam.snapshot([LIFECYCLE_INDEX_STORE])).rows(LIFECYCLE_INDEX_STORE);
    expect(index).toHaveLength(1);
    expect(index[0]?.state).toBe("Planned");
  });

  it("should return a typed no-write rejection and stage nothing when the supplied reconciliation does not bind the exact candidate set that was prepared", async () => {
    const applied = await applyFixture(seam, {}, { candidateTradeIds: ["candidate:someone-else"] });

    expect(applied).toMatchObject({ outcome: "NoWrite", reason: "UnboundReconciliation" });
    expect(Object.keys(applied)).not.toContain("participants");
    expect((await seam.snapshot([TRADE_FACT_STORE])).rows(TRADE_FACT_STORE)).toEqual([]);
  });

  it("should return a typed no-write rejection naming the changed revision and stage nothing when a base revision changed after preparation", async () => {
    const fixture = await confirmFixture(seam);
    const first = await applyPreparedChange(seam, {
      preparation: fixture.preparation,
      reconciliation: fixture.reconciliation,
      committedAt: PLAN_SAVE_TIME,
    });
    if (first.outcome !== "Staged") throw new Error("the first apply did not stage");
    await seam.commit({ participants: first.participants });

    const second = await applyPreparedChange(seam, {
      preparation: fixture.preparation,
      reconciliation: fixture.reconciliation,
      committedAt: PLAN_SAVE_TIME,
    });

    expect(second.outcome).toBe("NoWrite");
    if (second.outcome !== "NoWrite") return;
    expect(["StaleRevision"]).toContain(second.reason);
  });

  it("should return a typed no-write rejection and stage nothing when the digest of the re-supplied preparation does not match the digest recorded at preparation time", async () => {
    const applied = await applyFixture(seam, {}, { candidateDigest: "0".repeat(64) });

    expect(applied).toMatchObject({ outcome: "NoWrite", reason: "DigestMismatch" });
    expect(Object.keys(applied)).not.toContain("participants");
  });

  it("should roll back every staged D2 effect when the surrounding transaction is aborted by a Journal participant failure after this operation has run", async () => {
    const applied = await applyFixture(seam);
    if (applied.outcome !== "Staged") throw new Error("the apply did not stage");

    await expect(
      seam.commit({
        participants: [
          ...applied.participants,
          { store: "storeThatDoesNotExist", put: [{ id: "x" }] },
        ],
      }),
    ).rejects.toBeDefined();

    const facts = (await seam.snapshot([TRADE_FACT_STORE])).rows(TRADE_FACT_STORE);
    const lifecycle = (await seam.snapshot([TRADE_LIFECYCLE_STORE])).rows(TRADE_LIFECYCLE_STORE);
    const index = (await seam.snapshot([LIFECYCLE_INDEX_STORE])).rows(LIFECYCLE_INDEX_STORE);
    expect(facts).toEqual([]);
    expect(lifecycle).toEqual([]);
    expect(index).toEqual([]);
  });

  it("should return the staged Trade projection at its exact new FactRevision and the committed Plan, Planned Legs and original management values when the surrounding transaction commits", async () => {
    const applied = await applyFixture(seam);
    if (applied.outcome !== "Staged") throw new Error("the apply did not stage");
    await seam.commit({ participants: applied.participants });

    const projection = applied.projections[0];
    expect(projection?.factRevision).toBe(1);
    expect(projection?.lifecycle).toBe("Planned");
    expect(projection?.plan.intendedEntry).toEqual({ amount: "180.00" });
    expect(projection?.plan.plannedLegs).toHaveLength(1);
    expect(projection?.plan.originalManagement).toHaveLength(2);
    expect(Number(projection?.oneR.amount)).toBe(500);

    const lifecycle = (await seam.snapshot([TRADE_LIFECYCLE_STORE])).rows(TRADE_LIFECYCLE_STORE);
    expect(lifecycle[0]?.factRevision).toBe(projection?.factRevision);
  });

  it("should reject the change and stage nothing when the prepared candidate carries no reconciliation at all, because the caller must supply the expected derived state rather than an implied default", async () => {
    const fixture = await confirmFixture(seam);

    const applied = await applyPreparedChange(seam, {
      preparation: fixture.preparation,
      committedAt: PLAN_SAVE_TIME,
    });

    expect(applied).toMatchObject({ outcome: "NoWrite", reason: "MissingReconciliation" });
    expect(Object.keys(applied)).not.toContain("participants");
  });
});
