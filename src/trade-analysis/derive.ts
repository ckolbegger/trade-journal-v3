import type {
  ExecutionRecord,
  PlannedLegIntent,
  TradeLifecycleState,
} from '../persistence/idb';
import {
  add,
  cmp,
  div,
  ExactNumber,
  fromInteger,
  isPositive,
  mul,
  sub,
  toDecimalString,
  toMoneyString,
  toRatioString,
  type Rational,
  type SerializedRational,
} from '../shared/exact-number';

export interface DerivedOpenLot {
  readonly executionId: string;
  readonly positionChangeId: string;
  readonly economicTime: string;
  readonly quantity: Rational;
  readonly quantityDisplay: string;
  readonly fillPrice: Rational;
  readonly fillPriceDisplay: string;
  readonly unconsumedOpeningFee: Rational;
  readonly unconsumedOpeningFeeDisplay: string;
  readonly plannedLegIntent: PlannedLegIntent;
}

export type PlannedLegFulfillment =
  | 'NotEntered'
  | 'PartiallyFilled'
  | 'FilledAsPlanned'
  | 'FilledWithDeviation'
  | 'UnplannedExposure';

export interface DerivedDeviation {
  readonly kind: 'EntrySize' | 'UnplannedExposure';
  readonly message: string;
}

export interface EntryQualityMetrics {
  readonly averageEntryPrice: Rational;
  readonly averageEntryPriceDisplay: string;
  readonly slippagePerShare: Rational;
  readonly slippagePerShareDisplay: string;
  readonly actualInitialRisk: Rational;
  readonly actualInitialRiskDisplay: string;
  readonly actualInitialReward: Rational;
  readonly actualInitialRewardDisplay: string;
  readonly actualInitialRR: Rational | null;
  readonly actualInitialRRDisplay: string;
  readonly sizeVsPlannedRatio: Rational;
  readonly sizeVsPlannedDisplay: string;
}

export interface DerivedLongStockState {
  readonly derivedLifecycleState: TradeLifecycleState;
  readonly integrityDisagreement: boolean;
  readonly openLots: readonly DerivedOpenLot[];
  readonly openShares: Rational;
  readonly openSharesDisplay: string;
  readonly averageEntryPrice: Rational | null;
  readonly averageEntryPriceDisplay: string;
  readonly totalOpeningFees: Rational;
  readonly totalOpeningFeesDisplay: string;
  readonly fulfillment: PlannedLegFulfillment;
  readonly entryQuality: EntryQualityMetrics | null;
  readonly deviations: readonly DerivedDeviation[];
}

function formatShares(rat: Rational): string {
  return rat.den === 1n ? rat.num.toString() : toDecimalString(rat, 4).replace(/\.?0+$/, '');
}

export function deriveLongStockPosition(input: {
  readonly storedLifecycleState: TradeLifecycleState;
  readonly plan: {
    readonly plannedQuantity: SerializedRational;
    readonly intendedEntryPrice: SerializedRational;
    readonly stopPrice: SerializedRational;
    readonly targetPrice: SerializedRational;
  };
  readonly executions: readonly ExecutionRecord[];
}): DerivedLongStockState {
  const plannedQty = ExactNumber.fromJSON(input.plan.plannedQuantity);
  const intendedEntry = ExactNumber.fromJSON(input.plan.intendedEntryPrice);
  const stopPrice = ExactNumber.fromJSON(input.plan.stopPrice);
  const targetPrice = ExactNumber.fromJSON(input.plan.targetPrice);

  const sortedExecs = [...input.executions].sort((a, b) => {
    const byTime = a.economicTime.localeCompare(b.economicTime);
    return byTime !== 0 ? byTime : a.recordedSequence - b.recordedSequence;
  });

  const openLots: DerivedOpenLot[] = [];
  let openShares = fromInteger(0);
  let plannedIntentShares = fromInteger(0);
  let unplannedShares = fromInteger(0);
  let totalCostBasis = fromInteger(0);
  let totalOpeningFees = fromInteger(0);

  for (const exec of sortedExecs) {
    if (exec.side !== 'Buy') continue;
    const qty = ExactNumber.fromJSON(exec.quantity);
    const price = ExactNumber.fromJSON(exec.fillPrice);
    const fee = ExactNumber.fromJSON(exec.fee);

    openLots.push({
      executionId: exec.id,
      positionChangeId: exec.positionChangeId,
      economicTime: exec.economicTime,
      quantity: qty,
      quantityDisplay: formatShares(qty),
      fillPrice: price,
      fillPriceDisplay: toMoneyString(price),
      unconsumedOpeningFee: fee,
      unconsumedOpeningFeeDisplay: toMoneyString(fee),
      plannedLegIntent: exec.plannedLegIntent,
    });

    openShares = add(openShares, qty);
    totalCostBasis = add(totalCostBasis, mul(qty, price));
    totalOpeningFees = add(totalOpeningFees, fee);

    if (exec.plannedLegIntent === 'PlannedLeg') {
      plannedIntentShares = add(plannedIntentShares, qty);
    } else {
      unplannedShares = add(unplannedShares, qty);
    }
  }

  const hasOpenPosition = isPositive(openShares);
  const derivedLifecycleState: TradeLifecycleState = hasOpenPosition ? 'Open' : 'Planned';
  const integrityDisagreement = input.storedLifecycleState !== derivedLifecycleState;

  const deviations: DerivedDeviation[] = [];
  if (cmp(plannedIntentShares, plannedQty) > 0) {
    deviations.push({
      kind: 'EntrySize',
      message: `Entered ${formatShares(plannedIntentShares)} planned-leg shares vs ${formatShares(plannedQty)} planned.`,
    });
  }
  if (isPositive(unplannedShares)) {
    deviations.push({
      kind: 'UnplannedExposure',
      message: `Recorded ${formatShares(unplannedShares)} shares marked Explicitly Unplanned.`,
    });
  }

  let fulfillment: PlannedLegFulfillment;
  if (!hasOpenPosition) {
    fulfillment = 'NotEntered';
  } else if (isPositive(unplannedShares)) {
    fulfillment = 'UnplannedExposure';
  } else {
    const sizeCmp = cmp(plannedIntentShares, plannedQty);
    if (sizeCmp < 0) {
      fulfillment = 'PartiallyFilled';
    } else if (sizeCmp === 0) {
      fulfillment = 'FilledAsPlanned';
    } else {
      fulfillment = 'FilledWithDeviation';
    }
  }

  let averageEntryPrice: Rational | null = null;
  let entryQuality: EntryQualityMetrics | null = null;

  if (hasOpenPosition) {
    averageEntryPrice = div(totalCostBasis, openShares);
    const slippagePerShare = sub(averageEntryPrice, intendedEntry);
    const actualInitialRisk = add(
      mul(sub(averageEntryPrice, stopPrice), openShares),
      totalOpeningFees,
    );
    const actualInitialReward = sub(
      mul(sub(targetPrice, averageEntryPrice), openShares),
      totalOpeningFees,
    );
    const actualInitialRR = isPositive(actualInitialRisk)
      ? div(actualInitialReward, actualInitialRisk)
      : null;
    const sizeVsPlannedRatio = div(openShares, plannedQty);
    const pct = mul(sizeVsPlannedRatio, fromInteger(100));

    entryQuality = {
      averageEntryPrice,
      averageEntryPriceDisplay: toMoneyString(averageEntryPrice),
      slippagePerShare,
      slippagePerShareDisplay: toMoneyString(slippagePerShare, true),
      actualInitialRisk,
      actualInitialRiskDisplay: toMoneyString(actualInitialRisk),
      actualInitialReward,
      actualInitialRewardDisplay: toMoneyString(actualInitialReward),
      actualInitialRR,
      actualInitialRRDisplay: actualInitialRR ? toRatioString(actualInitialRR) : 'Unavailable',
      sizeVsPlannedRatio,
      sizeVsPlannedDisplay: `${toDecimalString(pct, 0)}% (${formatShares(openShares)} / ${formatShares(plannedQty)})`,
    };
  }

  return {
    derivedLifecycleState,
    integrityDisagreement,
    openLots,
    openShares,
    openSharesDisplay: formatShares(openShares),
    averageEntryPrice,
    averageEntryPriceDisplay: averageEntryPrice ? toMoneyString(averageEntryPrice) : '—',
    totalOpeningFees,
    totalOpeningFeesDisplay: toMoneyString(totalOpeningFees),
    fulfillment,
    entryQuality,
    deviations,
  };
}
