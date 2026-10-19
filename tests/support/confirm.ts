import { assessPlan, frozenBaseline } from "../../src/analysis/trade";
import type { PlannedLeg, TradePlan } from "../../src/plan";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import {
  applyPreparedChange,
  prepareChange,
  type DerivedTradeReconciliation,
  type TradeRecordApplyResult,
} from "../../src/trade-record";
import {
  LONG_STOCK_SHAPE,
  PLAN_ECONOMIC_TIME,
  PLAN_SAVE_TIME,
  longStockPlan,
} from "./plans";

export interface ConfirmFixtureOverrides {
  readonly plan?: TradePlan;
  readonly plannedLegs?: readonly PlannedLeg[];
}

export interface ConfirmFixture {
  readonly preparation: Awaited<ReturnType<typeof prepareChange>>;
  readonly reconciliation: DerivedTradeReconciliation;
  readonly oneR: string;
}

/** Prepare a real long stock confirmation and the real Trade Analysis reconciliation for it. */
export async function confirmFixture(
  seam: TransactionSeam,
  overrides: ConfirmFixtureOverrides = {},
): Promise<ConfirmFixture> {
  const plan =
    overrides.plan ??
    longStockPlan(overrides.plannedLegs === undefined ? {} : { plannedLegs: overrides.plannedLegs });

  const assessment = await assessPlan({
    strategyShape: LONG_STOCK_SHAPE,
    plan,
    economicTime: PLAN_ECONOMIC_TIME,
  });
  if (assessment.outcome !== "Accepted") {
    throw new Error(`the fixture Plan was rejected: ${assessment.issues.map((i) => i.code).join(",")}`);
  }
  const baseline = frozenBaseline(assessment);
  if (baseline === undefined) throw new Error("the fixture Plan produced no frozen baseline");

  const preparation = await prepareChange(seam, {
    kind: "ConfirmPlan",
    accountId: "account:institution:fidelity:brokerage-one",
    strategyStableKey: "strategy.long-stock",
    strategyShape: LONG_STOCK_SHAPE,
    tags: [],
    plan,
    economicTime: PLAN_ECONOMIC_TIME,
    saveTime: PLAN_SAVE_TIME,
  });
  if (preparation.outcome !== "Prepared") {
    throw new Error(`the fixture preparation did not produce a candidate: ${preparation.outcome}`);
  }

  return {
    preparation,
    oneR: baseline.oneR.amount,
    reconciliation: {
      candidateDigest: preparation.digest,
      candidateTradeIds: [preparation.candidate.tradeId],
      expectedLifecycle: "Planned",
      planBaseline: baseline,
      oneR: baseline.oneR,
    },
  };
}

export async function applyFixture(
  seam: TransactionSeam,
  overrides: ConfirmFixtureOverrides = {},
  reconciliationOverride?: Partial<DerivedTradeReconciliation>,
): Promise<TradeRecordApplyResult> {
  const fixture = await confirmFixture(seam, overrides);
  return applyPreparedChange(seam, {
    preparation: fixture.preparation,
    reconciliation: { ...fixture.reconciliation, ...reconciliationOverride },
    committedAt: PLAN_SAVE_TIME,
    cutoffTradingDate: "2026-10-19",
  });
}
