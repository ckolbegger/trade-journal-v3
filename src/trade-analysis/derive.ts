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

export interface DerivedLotMatch {
  readonly openingExecutionId: string;
  readonly disposalExecutionId: string;
  readonly openedAtEconomicTime: string;
  readonly disposedAtEconomicTime: string;
  readonly matchedQuantity: Rational;
  readonly matchedQuantityDisplay: string;
  readonly openingPrice: Rational;
  readonly openingPriceDisplay: string;
  readonly disposalPrice: Rational;
  readonly disposalPriceDisplay: string;
  readonly allocatedOpeningFee: Rational;
  readonly allocatedDisposalFee: Rational;
  readonly realizedPnl: Rational;
  readonly realizedPnlDisplay: string;
}

export interface FeeReconciliation {
  readonly incurredFees: Rational;
  readonly incurredFeesDisplay: string;
  readonly openingFeesIncurred: Rational;
  readonly openingFeesIncurredDisplay: string;
  readonly openingFeesAllocated: Rational;
  readonly openingFeesAllocatedDisplay: string;
  readonly openingFeesUnconsumed: Rational;
  readonly openingFeesUnconsumedDisplay: string;
  readonly disposalFeesIncurred: Rational;
  readonly disposalFeesIncurredDisplay: string;
  readonly disposalFeesAllocated: Rational;
  readonly disposalFeesAllocatedDisplay: string;
}

export type EntryExitScaling = 'SingleEntrySingleExit' | 'Scaled';

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
  readonly lotMatches: readonly DerivedLotMatch[];
  readonly feeReconciliation: FeeReconciliation;
  readonly openShares: Rational;
  readonly openSharesDisplay: string;
  readonly totalSoldShares: Rational;
  readonly totalSoldSharesDisplay: string;
  readonly averageEntryPrice: Rational | null;
  readonly averageEntryPriceDisplay: string;
  readonly totalOpeningFees: Rational;
  readonly totalOpeningFeesDisplay: string;
  readonly realizedPnl: Rational;
  readonly realizedPnlDisplay: string;
  readonly realizedR: Rational | null;
  readonly realizedRDisplay: string | null;
  readonly entryExitScaling: EntryExitScaling | null;
  readonly terminalDisposition: string | null;
  readonly oversold: boolean;
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
  readonly originalPlannedRisk?: SerializedRational;
  readonly executions: readonly ExecutionRecord[];
}): DerivedLongStockState {
  const plannedQty = ExactNumber.fromJSON(input.plan.plannedQuantity);
  const intendedEntry = ExactNumber.fromJSON(input.plan.intendedEntryPrice);
  const stopPrice = ExactNumber.fromJSON(input.plan.stopPrice);
  const targetPrice = ExactNumber.fromJSON(input.plan.targetPrice);
  const oneR = input.originalPlannedRisk ? ExactNumber.fromJSON(input.originalPlannedRisk) : null;

  const sortedExecs = [...input.executions].sort((a, b) => {
    const byTime = a.economicTime.localeCompare(b.economicTime);
    return byTime !== 0 ? byTime : a.recordedSequence - b.recordedSequence;
  });

  interface MutableLot {
    executionId: string;
    positionChangeId: string;
    economicTime: string;
    remainingQty: Rational;
    fillPrice: Rational;
    remainingFee: Rational;
    plannedLegIntent: PlannedLegIntent;
  }

  const mutableLots: MutableLot[] = [];
  const lotMatches: DerivedLotMatch[] = [];

  let buyCount = 0;
  let sellCount = 0;
  let totalBoughtShares = fromInteger(0);
  let totalOpeningCostBasis = fromInteger(0);
  let totalOpeningFees = fromInteger(0);
  let totalSoldShares = fromInteger(0);
  let totalDisposalFees = fromInteger(0);
  let openingFeesAllocated = fromInteger(0);
  let disposalFeesAllocated = fromInteger(0);
  let realizedPnl = fromInteger(0);
  let plannedIntentShares = fromInteger(0);
  let unplannedShares = fromInteger(0);
  let oversold = false;

  for (const exec of sortedExecs) {
    const qty = ExactNumber.fromJSON(exec.quantity);
    const price = ExactNumber.fromJSON(exec.fillPrice);
    const fee = ExactNumber.fromJSON(exec.fee);

    if (exec.side === 'Buy') {
      buyCount += 1;
      mutableLots.push({
        executionId: exec.id,
        positionChangeId: exec.positionChangeId,
        economicTime: exec.economicTime,
        remainingQty: qty,
        fillPrice: price,
        remainingFee: fee,
        plannedLegIntent: exec.plannedLegIntent,
      });

      totalBoughtShares = add(totalBoughtShares, qty);
      totalOpeningCostBasis = add(totalOpeningCostBasis, mul(qty, price));
      totalOpeningFees = add(totalOpeningFees, fee);

      if (exec.plannedLegIntent === 'PlannedLeg') {
        plannedIntentShares = add(plannedIntentShares, qty);
      } else {
        unplannedShares = add(unplannedShares, qty);
      }
      continue;
    }

    // FIFO Sell matching
    sellCount += 1;
    totalSoldShares = add(totalSoldShares, qty);
    totalDisposalFees = add(totalDisposalFees, fee);

    let sellRemaining = qty;
    for (const lot of mutableLots) {
      if (!isPositive(sellRemaining)) break;
      if (!isPositive(lot.remainingQty)) continue;

      const matchedQty =
        cmp(sellRemaining, lot.remainingQty) <= 0 ? sellRemaining : lot.remainingQty;
      const openFeeShare = mul(lot.remainingFee, div(matchedQty, lot.remainingQty));
      const dispFeeShare = isPositive(qty) ? mul(fee, div(matchedQty, qty)) : fromInteger(0);
      const grossPnl = mul(sub(price, lot.fillPrice), matchedQty);
      const matchNetPnl = sub(sub(grossPnl, openFeeShare), dispFeeShare);

      lotMatches.push({
        openingExecutionId: lot.executionId,
        disposalExecutionId: exec.id,
        openedAtEconomicTime: lot.economicTime,
        disposedAtEconomicTime: exec.economicTime,
        matchedQuantity: matchedQty,
        matchedQuantityDisplay: formatShares(matchedQty),
        openingPrice: lot.fillPrice,
        openingPriceDisplay: toMoneyString(lot.fillPrice),
        disposalPrice: price,
        disposalPriceDisplay: toMoneyString(price),
        allocatedOpeningFee: openFeeShare,
        allocatedDisposalFee: dispFeeShare,
        realizedPnl: matchNetPnl,
        realizedPnlDisplay: toMoneyString(matchNetPnl, true),
      });

      lot.remainingQty = sub(lot.remainingQty, matchedQty);
      lot.remainingFee = sub(lot.remainingFee, openFeeShare);
      sellRemaining = sub(sellRemaining, matchedQty);
      openingFeesAllocated = add(openingFeesAllocated, openFeeShare);
      disposalFeesAllocated = add(disposalFeesAllocated, dispFeeShare);
      realizedPnl = add(realizedPnl, matchNetPnl);
    }

    if (isPositive(sellRemaining)) {
      oversold = true;
    }
  }

  const openLots: DerivedOpenLot[] = [];
  let openShares = fromInteger(0);
  let openCostBasis = fromInteger(0);
  for (const lot of mutableLots) {
    if (!isPositive(lot.remainingQty)) continue;
    openLots.push({
      executionId: lot.executionId,
      positionChangeId: lot.positionChangeId,
      economicTime: lot.economicTime,
      quantity: lot.remainingQty,
      quantityDisplay: formatShares(lot.remainingQty),
      fillPrice: lot.fillPrice,
      fillPriceDisplay: toMoneyString(lot.fillPrice),
      unconsumedOpeningFee: lot.remainingFee,
      unconsumedOpeningFeeDisplay: toMoneyString(lot.remainingFee),
      plannedLegIntent: lot.plannedLegIntent,
    });
    openShares = add(openShares, lot.remainingQty);
    openCostBasis = add(openCostBasis, mul(lot.remainingQty, lot.fillPrice));
  }

  const hasOpenPosition = isPositive(openShares);
  const hasAnyBuy = isPositive(totalBoughtShares);
  let derivedLifecycleState: TradeLifecycleState;
  if (!hasAnyBuy && !isPositive(totalSoldShares)) {
    derivedLifecycleState = 'Planned';
  } else if (hasOpenPosition || oversold) {
    derivedLifecycleState = 'Open';
  } else {
    derivedLifecycleState = 'Closed';
  }
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
  if (!hasAnyBuy) {
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

  const averageEntryPrice = hasOpenPosition ? div(openCostBasis, openShares) : null;

  let entryQuality: EntryQualityMetrics | null = null;
  if (hasAnyBuy) {
    const buyAverageEntry = div(totalOpeningCostBasis, totalBoughtShares);
    const slippagePerShare = sub(buyAverageEntry, intendedEntry);
    const actualInitialRisk = add(
      mul(sub(buyAverageEntry, stopPrice), totalBoughtShares),
      totalOpeningFees,
    );
    const actualInitialReward = sub(
      mul(sub(targetPrice, buyAverageEntry), totalBoughtShares),
      totalOpeningFees,
    );
    const actualInitialRR = isPositive(actualInitialRisk)
      ? div(actualInitialReward, actualInitialRisk)
      : null;
    const sizeVsPlannedRatio = div(totalBoughtShares, plannedQty);
    const pct = mul(sizeVsPlannedRatio, fromInteger(100));

    entryQuality = {
      averageEntryPrice: buyAverageEntry,
      averageEntryPriceDisplay: toMoneyString(buyAverageEntry),
      slippagePerShare,
      slippagePerShareDisplay: toMoneyString(slippagePerShare, true),
      actualInitialRisk,
      actualInitialRiskDisplay: toMoneyString(actualInitialRisk),
      actualInitialReward,
      actualInitialRewardDisplay: toMoneyString(actualInitialReward),
      actualInitialRR,
      actualInitialRRDisplay: actualInitialRR ? toRatioString(actualInitialRR) : 'Unavailable',
      sizeVsPlannedRatio,
      sizeVsPlannedDisplay: `${toDecimalString(pct, 0)}% (${formatShares(totalBoughtShares)} / ${formatShares(plannedQty)})`,
    };
  }

  const incurredFees = add(totalOpeningFees, totalDisposalFees);
  const openingFeesUnconsumed = sub(totalOpeningFees, openingFeesAllocated);
  const feeReconciliation: FeeReconciliation = {
    incurredFees,
    incurredFeesDisplay: toMoneyString(incurredFees),
    openingFeesIncurred: totalOpeningFees,
    openingFeesIncurredDisplay: toMoneyString(totalOpeningFees),
    openingFeesAllocated,
    openingFeesAllocatedDisplay: toMoneyString(openingFeesAllocated),
    openingFeesUnconsumed,
    openingFeesUnconsumedDisplay: toMoneyString(openingFeesUnconsumed),
    disposalFeesIncurred: totalDisposalFees,
    disposalFeesIncurredDisplay: toMoneyString(totalDisposalFees),
    disposalFeesAllocated,
    disposalFeesAllocatedDisplay: toMoneyString(disposalFeesAllocated),
  };

  const realizedR = oneR && isPositive(oneR) ? div(realizedPnl, oneR) : null;
  const entryExitScaling: EntryExitScaling | null =
    derivedLifecycleState === 'Closed'
      ? buyCount === 1 && sellCount === 1
        ? 'SingleEntrySingleExit'
        : 'Scaled'
      : null;
  const terminalDisposition =
    derivedLifecycleState === 'Closed'
      ? `Closed via sale of ${formatShares(totalSoldShares)} ${totalSoldShares.num === 1n && totalSoldShares.den === 1n ? 'share' : 'shares'}`
      : null;

  return {
    derivedLifecycleState,
    integrityDisagreement,
    openLots,
    lotMatches,
    feeReconciliation,
    openShares,
    openSharesDisplay: formatShares(openShares),
    totalSoldShares,
    totalSoldSharesDisplay: formatShares(totalSoldShares),
    averageEntryPrice,
    averageEntryPriceDisplay: averageEntryPrice ? toMoneyString(averageEntryPrice) : '—',
    totalOpeningFees,
    totalOpeningFeesDisplay: toMoneyString(totalOpeningFees),
    realizedPnl,
    realizedPnlDisplay: toMoneyString(realizedPnl, true),
    realizedR,
    realizedRDisplay: realizedR ? toRatioString(realizedR, true) : null,
    entryExitScaling,
    terminalDisposition,
    oversold,
    fulfillment,
    entryQuality,
    deviations,
  };
}
