import { describe, expect, it } from 'vitest';
import { ExactNumber, fromDecimalString, toMoneyString } from '../../src/shared/exact-number';
import { deriveLongStockPosition } from '../../src/trade-analysis/derive';
import { evaluateLongStockTrade } from '../../src/trade-analysis/evaluate';

const basePlan = {
  plannedQuantity: ExactNumber.toJSON(fromDecimalString('100')),
  intendedEntryPrice: ExactNumber.toJSON(fromDecimalString('50.00')),
  stopPrice: ExactNumber.toJSON(fromDecimalString('47.00')),
  targetPrice: ExactNumber.toJSON(fromDecimalString('56.00')),
};
// 1R = (50 - 47) * 100 = $300.00
const oneR = ExactNumber.toJSON(fromDecimalString('300.00'));

describe('TradeAnalysis.derive (FIFO Lot Matches, Lot-Aware Fees, & Closed Transitions)', () => {
  it('computes partial FIFO Lot Matches across multiple Buy lots, exact unconsumed opening fees, and zero fee double-counting in Open P&L', () => {
    // Lot 1: Buy 60 @ $50.00, fee $1.20 -> $0.02/sh
    // Lot 2: Buy 40 @ $52.00, fee $0.80 -> $0.02/sh
    // Partial Sell: Sell 70 @ $55.00, fee $1.40 -> consumes all 60 of Lot 1 ($1.20 open fee + 60/70*$1.40=$1.20 disp fee)
    // and 10 of Lot 2 ($0.20 open fee + 10/70*$1.40=$0.20 disp fee).
    // Remaining open lot: 30 of Lot 2 @ $52.00 with unconsumed opening fee $0.60!
    // LotMatch 1 (60 sh): (55 - 50)*60 - 1.20 - 1.20 = $300 - $2.40 = +$297.60
    // LotMatch 2 (10 sh): (55 - 52)*10 - 0.20 - 0.20 = $30 - $0.40 = +$29.60
    // Total Realized P&L = +$327.20
    const derived = deriveLongStockPosition({
      storedLifecycleState: 'Open',
      plan: basePlan,
      originalPlannedRisk: oneR,
      executions: [
        {
          id: 'buy-1',
          tradeId: 'trd-1',
          positionChangeId: 'pc-1',
          side: 'Buy',
          quantity: ExactNumber.toJSON(fromDecimalString('60')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('50.00')),
          fee: ExactNumber.toJSON(fromDecimalString('1.20')),
          plannedLegIntent: 'PlannedLeg',
          economicTime: '2026-11-18T14:35:00.000Z',
          recordedSequence: 2,
          recordedAt: '2026-11-18T14:35:05.000Z',
        },
        {
          id: 'buy-2',
          tradeId: 'trd-1',
          positionChangeId: 'pc-2',
          side: 'Buy',
          quantity: ExactNumber.toJSON(fromDecimalString('40')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('52.00')),
          fee: ExactNumber.toJSON(fromDecimalString('0.80')),
          plannedLegIntent: 'PlannedLeg',
          economicTime: '2026-11-18T15:00:00.000Z',
          recordedSequence: 3,
          recordedAt: '2026-11-18T15:00:05.000Z',
        },
        {
          id: 'sell-1',
          tradeId: 'trd-1',
          positionChangeId: 'pc-3',
          side: 'Sell',
          quantity: ExactNumber.toJSON(fromDecimalString('70')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('55.00')),
          fee: ExactNumber.toJSON(fromDecimalString('1.40')),
          plannedLegIntent: 'PlannedLeg',
          economicTime: '2026-11-19T15:00:00.000Z',
          recordedSequence: 4,
          recordedAt: '2026-11-19T15:00:05.000Z',
        },
      ],
    });

    expect(derived.derivedLifecycleState).toBe('Open');
    expect(derived.oversold).toBe(false);
    expect(derived.openSharesDisplay).toBe('30');
    expect(derived.openLots).toHaveLength(1);
    expect(derived.openLots[0]?.executionId).toBe('buy-2');
    expect(derived.openLots[0]?.quantityDisplay).toBe('30');
    expect(derived.openLots[0]?.unconsumedOpeningFeeDisplay).toBe('$0.60');
    expect(toMoneyString(derived.averageEntryPrice!)).toBe('$52.00');

    expect(derived.lotMatches).toHaveLength(2);
    expect(derived.lotMatches[0]?.openingExecutionId).toBe('buy-1');
    expect(derived.lotMatches[0]?.realizedPnlDisplay).toBe('+$297.60');
    expect(derived.lotMatches[1]?.openingExecutionId).toBe('buy-2');
    expect(derived.lotMatches[1]?.realizedPnlDisplay).toBe('+$29.60');
    expect(derived.realizedPnlDisplay).toBe('+$327.20');

    expect(derived.feeReconciliation.incurredFeesDisplay).toBe('$3.40');
    expect(derived.feeReconciliation.openingFeesIncurredDisplay).toBe('$2.00');
    expect(derived.feeReconciliation.openingFeesAllocatedDisplay).toBe('$1.40');
    expect(derived.feeReconciliation.openingFeesUnconsumedDisplay).toBe('$0.60');
    expect(derived.feeReconciliation.disposalFeesIncurredDisplay).toBe('$1.40');
    expect(derived.feeReconciliation.disposalFeesAllocatedDisplay).toBe('$1.40');
    expect(derived.entryExitScaling).toBeNull(); // still Open

    // Evaluate at $54.00: remaining 30 shares bought at $52.00 with $0.60 unconsumed open fee -> (54 - 52)*30 - 0.60 = +$59.40
    const ev = evaluateLongStockTrade({
      derived,
      plan: { stopPrice: basePlan.stopPrice, targetPrice: basePlan.targetPrice },
      originalPlannedRisk: oneR,
      expectedSessionDate: '2026-11-19',
      todayMark: {
        sessionDate: '2026-11-19',
        price: ExactNumber.toJSON(fromDecimalString('54.00')),
      },
      priorMark: null,
      todayUnavailableAcknowledged: false,
    });
    expect(ev.availability).toBe('Available');
    if (ev.availability === 'Available') {
      expect(ev.openPnlDisplay).toBe('+$59.40');
      expect(ev.realizedPnlDisplay).toBe('+$327.20');
      // Combined = 327.20 + 59.40 = +$386.60 -> /300 = +1.29R
      expect(ev.combinedPnlDisplay).toBe('+$386.60');
      expect(ev.combinedPnlRDisplay).toBe('+1.29R');
    }
  });

  it('transitions Open -> Closed on full exit with Terminal Disposition, Realized R, SingleEntrySingleExit vs Scaled, and detects oversell', () => {
    const singleClosed = deriveLongStockPosition({
      storedLifecycleState: 'Closed',
      plan: basePlan,
      originalPlannedRisk: oneR,
      executions: [
        {
          id: 'b1',
          tradeId: 'trd-2',
          positionChangeId: 'pc-1',
          side: 'Buy',
          quantity: ExactNumber.toJSON(fromDecimalString('100')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('50.00')),
          fee: ExactNumber.toJSON(fromDecimalString('1.00')),
          plannedLegIntent: 'PlannedLeg',
          economicTime: '2026-11-18T14:35:00.000Z',
          recordedSequence: 2,
          recordedAt: '2026-11-18T14:35:05.000Z',
        },
        {
          id: 's1',
          tradeId: 'trd-2',
          positionChangeId: 'pc-2',
          side: 'Sell',
          quantity: ExactNumber.toJSON(fromDecimalString('100')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('56.00')),
          fee: ExactNumber.toJSON(fromDecimalString('1.00')),
          plannedLegIntent: 'PlannedLeg',
          economicTime: '2026-11-20T15:00:00.000Z',
          recordedSequence: 3,
          recordedAt: '2026-11-20T15:00:05.000Z',
        },
      ],
    });

    expect(singleClosed.derivedLifecycleState).toBe('Closed');
    expect(singleClosed.openSharesDisplay).toBe('0');
    expect(singleClosed.terminalDisposition).toBe('Closed via sale of 100 shares');
    // (56 - 50)*100 - 2.00 = +$598.00; 598 / 300 = +1.99R
    expect(singleClosed.realizedPnlDisplay).toBe('+$598.00');
    expect(singleClosed.realizedRDisplay).toBe('+1.99R');
    expect(singleClosed.entryExitScaling).toBe('SingleEntrySingleExit');
    expect(singleClosed.feeReconciliation.openingFeesUnconsumedDisplay).toBe('$0.00');
    // Entry Quality preserved even after full exit!
    expect(singleClosed.entryQuality?.actualInitialRiskDisplay).toBe('$301.00');

    // Oversell flagged cleanly
    const oversold = deriveLongStockPosition({
      storedLifecycleState: 'Open',
      plan: basePlan,
      executions: [
        {
          id: 'b1',
          tradeId: 'trd-3',
          positionChangeId: 'pc-1',
          side: 'Buy',
          quantity: ExactNumber.toJSON(fromDecimalString('50')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('50.00')),
          fee: ExactNumber.toJSON(fromDecimalString('0.00')),
          plannedLegIntent: 'PlannedLeg',
          economicTime: '2026-11-18T14:35:00.000Z',
          recordedSequence: 2,
          recordedAt: '2026-11-18T14:35:05.000Z',
        },
        {
          id: 's1',
          tradeId: 'trd-3',
          positionChangeId: 'pc-2',
          side: 'Sell',
          quantity: ExactNumber.toJSON(fromDecimalString('60')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('51.00')),
          fee: ExactNumber.toJSON(fromDecimalString('0.00')),
          plannedLegIntent: 'PlannedLeg',
          economicTime: '2026-11-19T15:00:00.000Z',
          recordedSequence: 3,
          recordedAt: '2026-11-19T15:00:05.000Z',
        },
      ],
    });
    expect(oversold.oversold).toBe(true);
  });
});
