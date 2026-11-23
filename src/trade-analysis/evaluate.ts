import {
  abs,
  cmp,
  div,
  ExactNumber,
  isPositive,
  mul,
  sub,
  toMoneyString,
  toRatioString,
  type Rational,
  type SerializedRational,
} from '../shared/exact-number';
import type { DerivedLongStockState } from './derive';

export interface MarkPointInput {
  readonly sessionDate: string;
  readonly price: SerializedRational;
}

export interface EvaluatedStopCondition {
  readonly role: 'Stop';
  readonly status: 'Active' | 'Breached';
  readonly nearest: boolean;
  readonly triggerPrice: Rational;
  readonly triggerPriceDisplay: string;
  readonly impactDollars: Rational;
  readonly impactDisplay: string;
  readonly impactR: Rational;
  readonly impactRDisplay: string;
  readonly overrunDollars: Rational | null;
  readonly overrunDisplay: string | null;
}

export interface EvaluatedTargetCondition {
  readonly role: 'Target';
  readonly status: 'Active' | 'Reached';
  readonly nearest: boolean;
  readonly triggerPrice: Rational;
  readonly triggerPriceDisplay: string;
  readonly impactDollars: Rational;
  readonly impactDisplay: string;
  readonly impactR: Rational;
  readonly impactRDisplay: string;
}

export interface AvailableLongStockEvaluation {
  readonly availability: 'Available';
  readonly sessionDate: string;
  readonly currentMark: Rational;
  readonly currentMarkDisplay: string;
  readonly priorSessionDate: string | null;
  readonly priorMark: Rational | null;
  readonly priorMarkDisplay: string | null;
  readonly markChangeDisplay: string | null;
  readonly openPnl: Rational;
  readonly openPnlDisplay: string;
  readonly openPnlR: Rational;
  readonly openPnlRDisplay: string;
  readonly dailyChange: Rational | null;
  readonly dailyChangeDisplay: string | null;
  readonly stopCondition: EvaluatedStopCondition;
  readonly targetCondition: EvaluatedTargetCondition;
  readonly worstCaseRisk: Rational;
  readonly worstCaseRiskDisplay: string;
  readonly worstCaseRiskRDisplay: string;
}

export interface UnavailableLongStockEvaluation {
  readonly availability: 'Unavailable';
  readonly expectedSessionDate: string;
  readonly acknowledgedUnavailable: boolean;
  /**
   * OV-04: Authoritative today valuation stays Unavailable, while meter and risk/reward
   * context may render explicitly dated and muted from the most recent completely marked prior session.
   */
  readonly priorContext: {
    readonly asOfSessionDate: string;
    readonly evaluation: AvailableLongStockEvaluation;
  } | null;
}

export type LongStockEvaluation =
  | AvailableLongStockEvaluation
  | UnavailableLongStockEvaluation;

function evaluateAtExactMark(params: {
  readonly derived: DerivedLongStockState;
  readonly stopPrice: Rational;
  readonly targetPrice: Rational;
  readonly oneR: Rational;
  readonly mark: MarkPointInput;
  readonly priorMark: MarkPointInput | null;
}): AvailableLongStockEvaluation {
  const { derived, stopPrice, targetPrice, oneR, mark, priorMark } = params;
  const currentPrice = ExactNumber.fromJSON(mark.price);
  const avgEntry = derived.averageEntryPrice!;
  const openShares = derived.openShares;

  const openPnl = sub(mul(sub(currentPrice, avgEntry), openShares), derived.totalOpeningFees);
  const openPnlR = div(openPnl, oneR);

  let priorPrice: Rational | null = null;
  let dailyChange: Rational | null = null;
  let markChangeDisplay: string | null = null;
  if (priorMark) {
    priorPrice = ExactNumber.fromJSON(priorMark.price);
    const priceDiff = sub(currentPrice, priorPrice);
    markChangeDisplay = toMoneyString(priceDiff, true);
    dailyChange = mul(priceDiff, openShares);
  }

  const stopBreached = cmp(currentPrice, stopPrice) <= 0;
  const stopImpact = mul(sub(stopPrice, currentPrice), openShares);
  const stopImpactR = div(stopImpact, oneR);
  const overrunDollars = stopBreached ? stopImpact : null;

  const targetReached = cmp(currentPrice, targetPrice) >= 0;
  const targetImpact = mul(sub(targetPrice, currentPrice), openShares);
  const targetImpactR = div(targetImpact, oneR);

  // Determine nearest active condition by absolute price distance from current Mark
  let stopNearest = false;
  let targetNearest = false;
  if (!stopBreached && !targetReached) {
    const distToStop = abs(sub(currentPrice, stopPrice));
    const distToTarget = abs(sub(targetPrice, currentPrice));
    if (cmp(distToStop, distToTarget) <= 0) {
      stopNearest = true;
    } else {
      targetNearest = true;
    }
  }

  const worstCaseRisk = mul(currentPrice, openShares);
  const worstCaseRiskR = div(worstCaseRisk, oneR);

  return {
    availability: 'Available',
    sessionDate: mark.sessionDate,
    currentMark: currentPrice,
    currentMarkDisplay: toMoneyString(currentPrice),
    priorSessionDate: priorMark?.sessionDate ?? null,
    priorMark: priorPrice,
    priorMarkDisplay: priorPrice ? toMoneyString(priorPrice) : null,
    markChangeDisplay,
    openPnl,
    openPnlDisplay: toMoneyString(openPnl, true),
    openPnlR,
    openPnlRDisplay: toRatioString(openPnlR, true),
    dailyChange,
    dailyChangeDisplay: dailyChange ? toMoneyString(dailyChange, true) : null,
    stopCondition: {
      role: 'Stop',
      status: stopBreached ? 'Breached' : 'Active',
      nearest: stopNearest,
      triggerPrice: stopPrice,
      triggerPriceDisplay: toMoneyString(stopPrice),
      impactDollars: stopImpact,
      impactDisplay: toMoneyString(stopImpact, true),
      impactR: stopImpactR,
      impactRDisplay: toRatioString(stopImpactR, true),
      overrunDollars,
      overrunDisplay: overrunDollars ? toMoneyString(overrunDollars) : null,
    },
    targetCondition: {
      role: 'Target',
      status: targetReached ? 'Reached' : 'Active',
      nearest: targetNearest,
      triggerPrice: targetPrice,
      triggerPriceDisplay: toMoneyString(targetPrice),
      impactDollars: targetImpact,
      impactDisplay: toMoneyString(targetImpact, true),
      impactR: targetImpactR,
      impactRDisplay: toRatioString(targetImpactR, true),
    },
    worstCaseRisk,
    worstCaseRiskDisplay: toMoneyString(worstCaseRisk),
    worstCaseRiskRDisplay: toRatioString(worstCaseRiskR),
  };
}

export function evaluateLongStockTrade(input: {
  readonly derived: DerivedLongStockState;
  readonly plan: {
    readonly stopPrice: SerializedRational;
    readonly targetPrice: SerializedRational;
  };
  readonly originalPlannedRisk: SerializedRational;
  readonly expectedSessionDate: string;
  readonly entrySessionDate?: string;
  readonly todayMark: MarkPointInput | null;
  readonly priorMark: MarkPointInput | null;
  readonly todayUnavailableAcknowledged: boolean;
}): LongStockEvaluation {
  const {
    derived,
    plan,
    originalPlannedRisk,
    expectedSessionDate,
    entrySessionDate,
    todayMark,
    priorMark,
  } = input;
  const stopPrice = ExactNumber.fromJSON(plan.stopPrice);
  const targetPrice = ExactNumber.fromJSON(plan.targetPrice);
  const oneR = ExactNumber.fromJSON(originalPlannedRisk);

  if (!isPositive(derived.openShares) || !derived.averageEntryPrice || !isPositive(oneR)) {
    return {
      availability: 'Unavailable',
      expectedSessionDate,
      acknowledgedUnavailable: input.todayUnavailableAcknowledged,
      priorContext: null,
    };
  }

  const validTodayMark =
    todayMark && todayMark.sessionDate === expectedSessionDate ? todayMark : null;
  const validPriorMark =
    priorMark && priorMark.sessionDate < expectedSessionDate ? priorMark : null;

  if (validTodayMark) {
    return evaluateAtExactMark({
      derived,
      stopPrice,
      targetPrice,
      oneR,
      mark: validTodayMark,
      priorMark: validPriorMark,
    });
  }

  const priorEligible =
    validPriorMark && (!entrySessionDate || validPriorMark.sessionDate >= entrySessionDate)
      ? validPriorMark
      : null;

  const priorContext = priorEligible
    ? {
        asOfSessionDate: priorEligible.sessionDate,
        evaluation: evaluateAtExactMark({
          derived,
          stopPrice,
          targetPrice,
          oneR,
          mark: priorEligible,
          priorMark: null,
        }),
      }
    : null;

  return {
    availability: 'Unavailable',
    expectedSessionDate,
    acknowledgedUnavailable: input.todayUnavailableAcknowledged,
    priorContext,
  };
}
