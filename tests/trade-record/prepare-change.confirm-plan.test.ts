import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PlannedLeg, StrategyShape, TradePlan } from "../../src/plan";
import {
  TRADE_FACT_STORE,
  TRADE_LIFECYCLE_STORE,
  prepareChange,
  type ConfirmPlanChange,
} from "../../src/trade-record";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { close, openD2Seam } from "../support/store";

/** The Long Stock shape exactly as the Catalog seed declares it. */
const LONG_STOCK: StrategyShape = {
  roles: [{ side: "long", kind: "stock", quantity: "1" }],
  constraints: [{ kind: "sameUnderlying", detail: "one Underlying" }],
};

function stockLeg(overrides: Partial<PlannedLeg> = {}): PlannedLeg {
  return {
    legId: "leg-1",
    instrument: { instrumentKey: "AAPL", instrumentClass: "stock" },
    side: "long",
    quantity: { amount: "100", instrumentClass: "stock" },
    contract: { kind: "ExactContract", expiration: undefined, strike: undefined },
    ...overrides,
  };
}

function plan(overrides: Partial<TradePlan> = {}): TradePlan {
  return {
    intendedEntry: { amount: "180.00" },
    plannedLegs: [stockLeg()],
    originalManagement: [
      {
        conditionId: "cond-stop",
        kind: "UnderlyingPrice",
        role: "Stop",
        boundaryPrice: { amount: "175.00" },
        monetaryBoundary: { amount: "500.00", currency: "USD" },
        basis: {
          protects: ["leg-1"],
          direction: "AtOrBelow",
          measurementPolicy: "NearestNonnegativeMonetaryBoundary",
          comment: "breaks below untouched demand zone",
        },
      },
      {
        conditionId: "cond-target",
        kind: "UnderlyingPrice",
        role: "Target",
        boundaryPrice: { amount: "190.00" },
        monetaryBoundary: { amount: "1000.00", currency: "USD" },
        basis: {
          protects: ["leg-1"],
          direction: "AtOrAbove",
          measurementPolicy: "NearestNonnegativeMonetaryBoundary",
        },
      },
    ],
    ...overrides,
  };
}

function change(overrides: Partial<ConfirmPlanChange> = {}): ConfirmPlanChange {
  return {
    kind: "ConfirmPlan",
    accountId: "account:institution:fidelity:brokerage-one",
    strategyStableKey: "strategy.long-stock",
    strategyShape: LONG_STOCK,
    tags: ["tag:swing"],
    plan: plan(),
    economicTime: "2026-10-19T20:30:00.000Z",
    saveTime: "2026-10-19T20:31:12.000Z",
    ...overrides,
  };
}

describe("TradeRecord.prepareChange for a ConfirmPlanChange, at the public prepareChange seam", () => {
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

  it("should return one candidate AnalysisInput record carrying the frozen Plan, the ordered Planned Legs and the original management conditions when the command supplies a complete long stock Plan and the expected revision matches", async () => {
    const result = await prepareChange(seam, change());

    expect(result.outcome).toBe("Prepared");
    if (result.outcome !== "Prepared") return;
    expect(result.candidate.candidate).toBe(true);
    expect(result.candidate.plan.intendedEntry).toEqual({ amount: "180.00" });
    expect(result.candidate.plan.plannedLegs).toEqual([stockLeg()]);
    expect(result.candidate.plan.originalManagement.map((c) => c.conditionId)).toEqual([
      "cond-stop",
      "cond-target",
    ]);
    expect(result.before).toBeUndefined();
  });

  it("should reserve no durable TradeId, TradeFactId or FactVersionId in the returned candidate when preparation succeeds, so that a prepared-but-never-applied command leaves the record set byte-identical", async () => {
    const before = await seam.snapshot([TRADE_FACT_STORE, TRADE_LIFECYCLE_STORE]);

    const result = await prepareChange(seam, change());
    expect(result.outcome).toBe("Prepared");
    if (result.outcome !== "Prepared") return;

    expect(result.candidate.tradeId.startsWith("candidate:")).toBe(true);
    expect(result.candidate.factRevision).toBe(0);

    const after = await seam.snapshot([TRADE_FACT_STORE, TRADE_LIFECYCLE_STORE]);
    expect(after.rows(TRADE_FACT_STORE)).toEqual(before.rows(TRADE_FACT_STORE));
    expect(after.rows(TRADE_LIFECYCLE_STORE)).toEqual(before.rows(TRADE_LIFECYCLE_STORE));
  });

  it("should return a canonical digest that is identical when the same semantic change is prepared twice with the same inputs and differs when any Plan value, leg quantity or management condition changes", async () => {
    const first = await prepareChange(seam, change());
    const second = await prepareChange(seam, change());
    expect(first.outcome).toBe("Prepared");
    expect(second.outcome).toBe("Prepared");
    if (first.outcome !== "Prepared" || second.outcome !== "Prepared") return;
    expect(second.digest).toBe(first.digest);

    const differentEntry = await prepareChange(
      seam,
      change({ plan: plan({ intendedEntry: { amount: "181.00" } }) }),
    );
    const differentQuantity = await prepareChange(
      seam,
      change({
        plan: plan({
          plannedLegs: [stockLeg({ quantity: { amount: "101", instrumentClass: "stock" } })],
        }),
      }),
    );
    const differentCondition = await prepareChange(
      seam,
      change({
        plan: plan({
          originalManagement: [
            {
              conditionId: "cond-stop",
              kind: "UnderlyingPrice",
              role: "Stop",
              boundaryPrice: { amount: "174.00" },
              monetaryBoundary: { amount: "600.00", currency: "USD" },
              basis: {
                protects: ["leg-1"],
                direction: "AtOrBelow",
                measurementPolicy: "NearestNonnegativeMonetaryBoundary",
              },
            },
          ],
        }),
      }),
    );
    for (const variant of [differentEntry, differentQuantity, differentCondition]) {
      expect(variant.outcome).toBe("Prepared");
      if (variant.outcome !== "Prepared") continue;
      expect(variant.digest).not.toBe(first.digest);
    }
  });

  it("should return the before AnalysisInput record for the referenced Trade identity together with the candidate when preparing a change to an existing Plan", async () => {
    await seam.commit({
      participants: [
        {
          store: TRADE_FACT_STORE,
          put: [
            {
              id: "trade-1:trade",
              tradeId: "trade-1",
              kind: "trade",
              accountId: "account:a",
              strategyStableKey: "strategy.long-stock",
              tags: [],
              economicTime: "2026-10-18T20:30:00.000Z",
              saveTime: "2026-10-18T20:31:00.000Z",
              recordedSequence: 1,
            },
            {
              id: "trade-1:plan",
              tradeId: "trade-1",
              kind: "plan",
              intendedEntry: { amount: "150.00" },
              economicTime: "2026-10-18T20:30:00.000Z",
            },
          ],
        },
        {
          store: TRADE_LIFECYCLE_STORE,
          put: [
            {
              tradeId: "trade-1",
              state: "Planned",
              factRevision: 4,
              effectiveFactDigest: "digest-1",
              causingFactId: "trade-1:plan",
            },
          ],
        },
      ],
    });

    const result = await prepareChange(
      seam,
      change({ tradeId: "trade-1", expectedFactRevision: 4 }),
    );

    expect(result.outcome).toBe("Prepared");
    if (result.outcome !== "Prepared") return;
    expect(result.before).toMatchObject({
      tradeId: "trade-1",
      candidate: false,
      factRevision: 4,
      accountId: "account:a",
    });
    expect(result.before?.plan.intendedEntry).toEqual({ amount: "150.00" });
    expect(result.candidate.plan.intendedEntry).toEqual({ amount: "180.00" });
  });

  it("should return a typed no-write rejection naming the changed revision and an empty candidate set when the expected Trade revision no longer matches the stored revision", async () => {
    await seam.commit({
      participants: [
        { store: TRADE_FACT_STORE, put: [{ id: "trade-1:trade", tradeId: "trade-1", kind: "trade" }] },
        {
          store: TRADE_LIFECYCLE_STORE,
          put: [{ tradeId: "trade-1", state: "Planned", factRevision: 9 }],
        },
      ],
    });

    const result = await prepareChange(
      seam,
      change({ tradeId: "trade-1", expectedFactRevision: 4 }),
    );

    expect(result).toMatchObject({
      outcome: "NoWrite",
      reason: "StaleRevision",
      expected: 4,
      current: 9,
      candidates: [],
    });
  });

  it("should reject a structurally incoherent leg set with a typed issue per offending leg and return no candidate when a leg has a non-positive quantity, a duplicated role, or a missing exact contract and missing objective criteria", async () => {
    const zero = await prepareChange(
      seam,
      change({
        plan: plan({
          plannedLegs: [stockLeg({ quantity: { amount: "0", instrumentClass: "stock" } })],
        }),
      }),
    );
    expect(zero.outcome).toBe("NoWrite");
    if (zero.outcome !== "NoWrite") return;
    expect(zero.candidates).toEqual([]);
    expect(zero.issues.map((issue) => issue.code)).toContain("NonPositiveQuantity");
    expect(zero.issues[0]?.legId).toBe("leg-1");

    const noEvidence = await prepareChange(
      seam,
      change({
        plan: plan({
          plannedLegs: [stockLeg({ contract: undefined, objectiveCriteria: undefined })],
        }),
      }),
    );
    expect(noEvidence.outcome).toBe("NoWrite");
    if (noEvidence.outcome !== "NoWrite") return;
    expect(noEvidence.issues.map((issue) => issue.code)).toContain("MissingContractEvidence");

    const duplicated = await prepareChange(
      seam,
      change({
        plan: plan({ plannedLegs: [stockLeg(), stockLeg({ legId: "leg-2" })] }),
      }),
    );
    expect(duplicated.outcome).toBe("NoWrite");
    if (duplicated.outcome !== "NoWrite") return;
    expect(duplicated.candidates).toEqual([]);
    const codes = duplicated.issues.map((issue) => issue.code);
    expect(codes).toContain("ShapeRoleCount");
    expect(codes).toContain("DuplicateRole");
  });

  it("should preserve the command's Economic Time in the returned records and keep it distinct from save time when the two differ", async () => {
    const result = await prepareChange(seam, change());

    expect(result.outcome).toBe("Prepared");
    if (result.outcome !== "Prepared") return;
    expect(result.candidate.economicTime).toBe("2026-10-19T20:30:00.000Z");
    expect(result.candidate.saveTime).toBe("2026-10-19T20:31:12.000Z");
    expect(result.candidate.economicTime).not.toBe(result.candidate.saveTime);
  });

  it("should reject a Plan whose ordered Planned Legs do not match the supplied Strategy shape with a typed shape-coherence issue when the shape declares one long Stock role and the command supplies a second leg", async () => {
    const result = await prepareChange(
      seam,
      change({
        plan: plan({
          plannedLegs: [
            stockLeg(),
            stockLeg({
              legId: "leg-2",
              instrument: { instrumentKey: "MSFT", instrumentClass: "stock" },
            }),
          ],
        }),
      }),
    );

    expect(result.outcome).toBe("NoWrite");
    if (result.outcome !== "NoWrite") return;
    expect(result.reason).toBe("ShapeMismatch");
    expect(result.candidates).toEqual([]);
    expect(result.issues.some((issue) => issue.code === "ShapeRoleCount")).toBe(true);
  });
});
