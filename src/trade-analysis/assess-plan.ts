import {
  cmp,
  div,
  isPositive,
  mul,
  sub,
  toMoneyString,
  toRatioString,
  tryFromDecimalString,
  type Rational,
} from '../shared/exact-number';

export interface LongStockPlanInput {
  readonly symbol: string;
  readonly quantity: string;
  readonly intendedEntryPrice: string;
  readonly stopPrice: string;
  readonly targetPrice: string;
}

export interface PlanFieldError {
  readonly field: 'symbol' | 'quantity' | 'intendedEntryPrice' | 'stopPrice' | 'targetPrice';
  readonly message: string;
}

export interface PlanBaseline {
  readonly riskPerShare: Rational;
  readonly rewardPerShare: Rational;
  readonly originalPlannedRisk: Rational;
  readonly originalPlannedReward: Rational;
  readonly plannedRewardToRisk: Rational;
  readonly originalPlannedRiskDisplay: string;
  readonly originalPlannedRewardDisplay: string;
  readonly plannedRewardToRiskDisplay: string;
}

export type AssessLongStockPlanResult =
  | {
      readonly status: 'Accepted';
      readonly normalizedSymbol: string;
      readonly quantity: Rational;
      readonly intendedEntryPrice: Rational;
      readonly stopPrice: Rational;
      readonly targetPrice: Rational;
      readonly baseline: PlanBaseline;
    }
  | {
      readonly status: 'Rejected';
      readonly errors: readonly PlanFieldError[];
    };

export function assessLongStockPlan(input: LongStockPlanInput): AssessLongStockPlanResult {
  const errors: PlanFieldError[] = [];

  const normalizedSymbol = input.symbol.trim().toUpperCase();
  if (!normalizedSymbol || !/^[A-Z0-9.-]{1,12}$/.test(normalizedSymbol)) {
    errors.push({
      field: 'symbol',
      message: 'Enter a valid stock symbol (e.g., AAPL, NVDA, BRK.B).',
    });
  }

  const quantity = tryFromDecimalString(input.quantity);
  if (!quantity || !isPositive(quantity)) {
    errors.push({
      field: 'quantity',
      message: 'Share quantity must be a positive number.',
    });
  }

  const intendedEntryPrice = tryFromDecimalString(input.intendedEntryPrice);
  if (!intendedEntryPrice || !isPositive(intendedEntryPrice)) {
    errors.push({
      field: 'intendedEntryPrice',
      message: 'Intended entry price must be greater than zero.',
    });
  }

  const stopPrice = tryFromDecimalString(input.stopPrice);
  if (!stopPrice || !isPositive(stopPrice)) {
    errors.push({
      field: 'stopPrice',
      message: 'Stop price must be greater than zero.',
    });
  }

  const targetPrice = tryFromDecimalString(input.targetPrice);
  if (!targetPrice || !isPositive(targetPrice)) {
    errors.push({
      field: 'targetPrice',
      message: 'Target price must be greater than zero.',
    });
  }

  if (intendedEntryPrice && stopPrice && cmp(stopPrice, intendedEntryPrice) >= 0) {
    errors.push({
      field: 'stopPrice',
      message: 'For Long Stock, Stop price must be below Intended Entry so 1R risk is positive.',
    });
  }

  if (intendedEntryPrice && targetPrice && cmp(targetPrice, intendedEntryPrice) <= 0) {
    errors.push({
      field: 'targetPrice',
      message: 'For Long Stock, Target price must be above Intended Entry.',
    });
  }

  if (errors.length > 0 || !quantity || !intendedEntryPrice || !stopPrice || !targetPrice) {
    return { status: 'Rejected', errors };
  }

  const riskPerShare = sub(intendedEntryPrice, stopPrice);
  const rewardPerShare = sub(targetPrice, intendedEntryPrice);
  const originalPlannedRisk = mul(riskPerShare, quantity);
  const originalPlannedReward = mul(rewardPerShare, quantity);
  const plannedRewardToRisk = div(originalPlannedReward, originalPlannedRisk);

  return {
    status: 'Accepted',
    normalizedSymbol,
    quantity,
    intendedEntryPrice,
    stopPrice,
    targetPrice,
    baseline: {
      riskPerShare,
      rewardPerShare,
      originalPlannedRisk,
      originalPlannedReward,
      plannedRewardToRisk,
      originalPlannedRiskDisplay: toMoneyString(originalPlannedRisk),
      originalPlannedRewardDisplay: toMoneyString(originalPlannedReward),
      plannedRewardToRiskDisplay: toRatioString(plannedRewardToRisk),
    },
  };
}
