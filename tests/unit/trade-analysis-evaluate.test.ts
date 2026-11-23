import { describe, expect, it } from 'vitest';
import { deriveLongStockPosition } from '../../src/trade-analysis/derive';
import { evaluateLongStockTrade } from '../../src/trade-analysis/evaluate';
import { ExactNumber, fromDecimalString } from '../../src/shared/exact-number';

const plan = {
  plannedQuantity: ExactNumber.toJSON(fromDecimalString('100')),
  intendedEntryPrice: ExactNumber.toJSON(fromDecimalString('50.00')),
  stopPrice: ExactNumber.toJSON(fromDecimalString('47.50')),
  targetPrice: ExactNumber.toJSON(fromDecimalString('56.00')),
};

const oneR = ExactNumber.toJSON(fromDecimalString('250.00'));

const derived = deriveLongStockPosition({
  storedLifecycleState: 'Open',
  plan,
  executions: [
    {
      id: 'exec-1',
      tradeId: 'trd-1',
      positionChangeId: 'pc-1',
      side: 'Buy',
      quantity: ExactNumber.toJSON(fromDecimalString('100')),
      fillPrice: ExactNumber.toJSON(fromDecimalString('50.10')),
      fee: ExactNumber.toJSON(fromDecimalString('1.00')),
      plannedLegIntent: 'PlannedLeg',
      economicTime: '2026-11-04T15:00:00.000Z',
      recordedSequence: 2,
      recordedAt: '2026-11-04T15:00:00.000Z',
    },
  ],
});

describe('TradeAnalysis.evaluate (Ongoing Risk/Reward & OV-04 Prior-Session Fallback) seam', () => {
  it('computes exact MTM P&L, Plan-R, daily change, Ongoing Risk to Stop, Incremental Reward to Target, nearest condition, and Worst-Case Risk', () => {
    const evalRes = evaluateLongStockTrade({
      derived,
      plan,
      originalPlannedRisk: oneR,
      expectedSessionDate: '2026-11-12',
      todayMark: {
        sessionDate: '2026-11-12',
        price: ExactNumber.toJSON(fromDecimalString('52.30')),
      },
      priorMark: {
        sessionDate: '2026-11-11',
        price: ExactNumber.toJSON(fromDecimalString('51.80')),
      },
      todayUnavailableAcknowledged: false,
    });

    expect(evalRes.availability).toBe('Available');
    if (evalRes.availability !== 'Available') return;
    // Open P&L = (52.30 - 50.10) * 100 - 1.00 = $219.00
    expect(evalRes.openPnlDisplay).toBe('+$219.00');
    // Daily change = (52.30 - 51.80) * 100 = +$50.00
    expect(evalRes.dailyChangeDisplay).toBe('+$50.00');
    // Stop condition: Active, impact = (47.50 - 52.30) * 100 = -$480.00 (-1.92R)
    expect(evalRes.stopCondition.status).toBe('Active');
    expect(evalRes.stopCondition.impactDisplay).toBe('-$480.00');
    expect(evalRes.stopCondition.impactRDisplay).toBe('-1.92R');
    // Target condition: Active, impact = (56.00 - 52.30) * 100 = +$370.00 (+1.48R), closer than Stop -> nearest!
    expect(evalRes.targetCondition.status).toBe('Active');
    expect(evalRes.targetCondition.impactDisplay).toBe('+$370.00');
    expect(evalRes.targetCondition.nearest).toBe(true);
    expect(evalRes.stopCondition.nearest).toBe(false);
    // Worst case if stock goes to $0 = $5,230.00 (20.92R)
    expect(evalRes.worstCaseRiskDisplay).toBe('$5,230.00');
  });

  it('marks Stop Breached with Overrun when Mark <= Stop, and Target Reached (not a Deviation) when Mark >= Target', () => {
    const breached = evaluateLongStockTrade({
      derived,
      plan,
      originalPlannedRisk: oneR,
      expectedSessionDate: '2026-11-12',
      todayMark: {
        sessionDate: '2026-11-12',
        price: ExactNumber.toJSON(fromDecimalString('46.00')),
      },
      priorMark: null,
      todayUnavailableAcknowledged: false,
    });
    expect(breached.availability).toBe('Available');
    if (breached.availability !== 'Available') return;
    expect(breached.stopCondition.status).toBe('Breached');
    expect(breached.stopCondition.overrunDisplay).toBe('$150.00');

    const reached = evaluateLongStockTrade({
      derived,
      plan,
      originalPlannedRisk: oneR,
      expectedSessionDate: '2026-11-12',
      todayMark: {
        sessionDate: '2026-11-12',
        price: ExactNumber.toJSON(fromDecimalString('57.00')),
      },
      priorMark: null,
      todayUnavailableAcknowledged: false,
    });
    expect(reached.availability).toBe('Available');
    if (reached.availability !== 'Available') return;
    expect(reached.targetCondition.status).toBe('Reached');
  });

  it('keeps authoritative today valuation Unavailable when today Mark is missing while supplying dated prior-session fallback (OV-04)', () => {
    const missingToday = evaluateLongStockTrade({
      derived,
      plan,
      originalPlannedRisk: oneR,
      expectedSessionDate: '2026-11-12',
      todayMark: null,
      priorMark: {
        sessionDate: '2026-11-11',
        price: ExactNumber.toJSON(fromDecimalString('51.80')),
      },
      todayUnavailableAcknowledged: false,
    });

    expect(missingToday.availability).toBe('Unavailable');
    if (missingToday.availability !== 'Unavailable') return;
    expect(missingToday.priorContext).not.toBeNull();
    expect(missingToday.priorContext?.asOfSessionDate).toBe('2026-11-11');
    // At $51.80: (51.80 - 50.10)*100 - 1.00 = +$169.00
    expect(missingToday.priorContext?.evaluation.openPnlDisplay).toBe('+$169.00');

    // When entrySessionDate is AFTER priorMark.sessionDate, priorContext must be null (position did not exist yet)
    const openedToday = evaluateLongStockTrade({
      derived,
      plan,
      originalPlannedRisk: oneR,
      expectedSessionDate: '2026-11-12',
      entrySessionDate: '2026-11-12',
      todayMark: null,
      priorMark: {
        sessionDate: '2026-11-11',
        price: ExactNumber.toJSON(fromDecimalString('51.80')),
      },
      todayUnavailableAcknowledged: false,
    });
    expect(openedToday.availability).toBe('Unavailable');
    if (openedToday.availability === 'Unavailable') {
      expect(openedToday.priorContext).toBeNull();
    }

    // When Stop is Breached, neither condition gets a misleading 'nearest' pill
    const breachedCheck = evaluateLongStockTrade({
      derived,
      plan,
      originalPlannedRisk: oneR,
      expectedSessionDate: '2026-11-12',
      todayMark: {
        sessionDate: '2026-11-12',
        price: ExactNumber.toJSON(fromDecimalString('46.00')),
      },
      priorMark: null,
      todayUnavailableAcknowledged: false,
    });
    expect(breachedCheck.availability).toBe('Available');
    if (breachedCheck.availability === 'Available') {
      expect(breachedCheck.stopCondition.nearest).toBe(false);
      expect(breachedCheck.targetCondition.nearest).toBe(false);
    }
  });

  it('handles exact Mark === Stop/Target boundaries, missing prior fallback when todayUnavailableAcknowledged, zero 1R, and partial-exit combinedPnl', () => {
    // Exact Mark === Stop ($47.50) -> Breached with $0.00 overrun
    const atStopExact = evaluateLongStockTrade({
      derived,
      plan,
      originalPlannedRisk: oneR,
      expectedSessionDate: '2026-11-12',
      todayMark: {
        sessionDate: '2026-11-12',
        price: ExactNumber.toJSON(fromDecimalString('47.50')),
      },
      priorMark: null,
      todayUnavailableAcknowledged: false,
    });
    expect(atStopExact.availability).toBe('Available');
    if (atStopExact.availability === 'Available') {
      expect(atStopExact.stopCondition.status).toBe('Breached');
      expect(atStopExact.stopCondition.overrunDisplay).toBe('$0.00');
    }

    // Exact Mark === Target ($56.00) -> Reached
    const atTargetExact = evaluateLongStockTrade({
      derived,
      plan,
      originalPlannedRisk: oneR,
      expectedSessionDate: '2026-11-12',
      todayMark: {
        sessionDate: '2026-11-12',
        price: ExactNumber.toJSON(fromDecimalString('56.00')),
      },
      priorMark: null,
      todayUnavailableAcknowledged: false,
    });
    expect(atTargetExact.availability).toBe('Available');
    if (atTargetExact.availability === 'Available') {
      expect(atTargetExact.targetCondition.status).toBe('Reached');
    }

    // todayUnavailableAcknowledged with zero prior mark -> acknowledgedUnavailable: true, priorContext: null
    const unavailNoPrior = evaluateLongStockTrade({
      derived,
      plan,
      originalPlannedRisk: oneR,
      expectedSessionDate: '2026-11-12',
      todayMark: null,
      priorMark: null,
      todayUnavailableAcknowledged: true,
    });
    expect(unavailNoPrior.availability).toBe('Unavailable');
    if (unavailNoPrior.availability === 'Unavailable') {
      expect(unavailNoPrior.acknowledgedUnavailable).toBe(true);
      expect(unavailNoPrior.priorContext).toBeNull();
    }

    // Zero originalPlannedRisk returns Unavailable without falling back to priorContext or dividing by zero
    const zeroOneR = evaluateLongStockTrade({
      derived,
      plan,
      originalPlannedRisk: ExactNumber.toJSON(fromDecimalString('0')),
      expectedSessionDate: '2026-11-12',
      todayMark: null,
      priorMark: {
        sessionDate: '2026-11-11',
        price: ExactNumber.toJSON(fromDecimalString('51.80')),
      },
      todayUnavailableAcknowledged: false,
    });
    expect(zeroOneR.availability).toBe('Unavailable');
    if (zeroOneR.availability === 'Unavailable') {
      expect(zeroOneR.priorContext).toBeNull();
    }

    // Partial-exit trade combines realizedPnl + openPnl cleanly
    const partialDerived = deriveLongStockPosition({
      storedLifecycleState: 'Open',
      plan,
      originalPlannedRisk: oneR,
      executions: [
        {
          id: 'b1',
          tradeId: 'trd-p',
          positionChangeId: 'pc-1',
          side: 'Buy',
          quantity: ExactNumber.toJSON(fromDecimalString('100')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('50.00')),
          fee: ExactNumber.toJSON(fromDecimalString('0.00')),
          plannedLegIntent: 'PlannedLeg',
          economicTime: '2026-11-10T15:00:00.000Z',
          recordedSequence: 2,
          recordedAt: '2026-11-10T15:00:00.000Z',
        },
        {
          id: 's1',
          tradeId: 'trd-p',
          positionChangeId: 'pc-2',
          side: 'Sell',
          quantity: ExactNumber.toJSON(fromDecimalString('50')),
          fillPrice: ExactNumber.toJSON(fromDecimalString('52.00')),
          fee: ExactNumber.toJSON(fromDecimalString('0.00')),
          plannedLegIntent: 'PlannedLeg',
          economicTime: '2026-11-11T15:00:00.000Z',
          recordedSequence: 3,
          recordedAt: '2026-11-11T15:00:00.000Z',
        },
      ],
    });
    const partialEval = evaluateLongStockTrade({
      derived: partialDerived,
      plan,
      originalPlannedRisk: oneR,
      expectedSessionDate: '2026-11-12',
      todayMark: {
        sessionDate: '2026-11-12',
        price: ExactNumber.toJSON(fromDecimalString('54.00')),
      },
      priorMark: null,
      todayUnavailableAcknowledged: false,
    });
    expect(partialEval.availability).toBe('Available');
    if (partialEval.availability === 'Available') {
      // Realized = +$100, Open = (54-50)*50 = +$200, Combined = +$300 (+1.20R)
      expect(partialEval.realizedPnlDisplay).toBe('+$100.00');
      expect(partialEval.openPnlDisplay).toBe('+$200.00');
      expect(partialEval.combinedPnlDisplay).toBe('+$300.00');
      expect(partialEval.combinedPnlRDisplay).toBe('+1.20R');
    }
  });
});
