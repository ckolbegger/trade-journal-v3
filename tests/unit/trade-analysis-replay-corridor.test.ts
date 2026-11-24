import { describe, expect, it } from 'vitest';
import { DAILY_TRADE_REVIEW_TYPE_ID } from '../../src/journal/journal';
import { fromDecimalString, fromInteger, toMoneyString } from '../../src/shared/exact-number';
import {
  assembleLongStockReplayInput,
  extractReplayReviewActions,
  replayLongStockTrade,
} from '../../src/trade-analysis/replay';
import {
  makeExecution,
  makeLongStockPlan,
  makeReviewActionEntry,
  ser,
} from '../helpers/builders';

function buildWorkedOpenModel() {
  // 100 shares @ $50.00, $1.00 opening fee; Stop $47.00, Target $56.00; 1R = $300.00, reward = $600.00
  // Nov 2: Mark $49.50 -> openPnl = (49.50 - 50.00)*100 - 1.00 = -$51.00 (-0.17R)
  // Nov 3: Mark $46.00 (Breached <= 47.00) -> openPnl = -$401.00, atStop = -$301.00, overrun = $100.00
  // Nov 4: Mark $57.00 (Reached >= 56.00) -> openPnl = +$699.00, atTarget = +$599.00, targetOverrun = $100.00
  return replayLongStockTrade({
    tradeId: 'trd-1',
    symbol: 'AXIO',
    sessions: ['2026-11-02', '2026-11-03', '2026-11-04'],
    reviewDate: '2026-11-04',
    plan: makeLongStockPlan(),
    originalPlannedRisk: ser('300.00'),
    originalPlannedReward: ser('600.00'),
    executions: [
      makeExecution({
        id: 'b1',
        quantity: '100',
        fillPrice: '50.00',
        fee: '1.00',
        economicTime: '2026-11-02T15:00:00.000Z',
      }),
    ],
    effectiveMarks: [
      { sessionDate: '2026-11-02', price: ser('49.50') },
      { sessionDate: '2026-11-03', price: ser('46.00') },
      { sessionDate: '2026-11-04', price: ser('57.00') },
    ],
    reviewActions: [
      { reviewDate: '2026-11-02', action: 'Hold', reason: null, conviction: 4 },
      {
        reviewDate: '2026-11-03',
        action: 'Hold',
        reason: 'Wait for close confirmation',
        conviction: 3,
      },
    ],
  });
}

describe('TradeAnalysis.replay (Long Stock Corridor Engine)', () => {
  it('computes opening-fee-adjusted Open P&L, Stop/Target rails, and R-multiples on Entry', () => {
    const model = buildWorkedOpenModel();
    expect(model.isClosed).toBe(false);
    expect(model.oneR).toEqual(fromDecimalString('300.00'));
    expect(model.planRails.stop).toEqual(fromDecimalString('-300.00'));
    expect(model.planRails.target).toEqual(fromDecimalString('600.00'));
    expect(model.sessions).toHaveLength(3);

    const s0 = model.sessions[0]!;
    expect(s0.totalPnl).toEqual(fromDecimalString('-51.00'));
    expect(s0.totalPnlDisplay).toBe('-$51.00');
    expect(s0.totalPnlRDisplay).toBe('-0.17R');
    expect(s0.atStopPnl).toEqual(fromDecimalString('-301.00'));
    expect(s0.atTargetPnl).toEqual(fromDecimalString('599.00'));
    expect(s0.riskToStop).toEqual(fromDecimalString('250.00'));
    expect(s0.rewardToTarget).toEqual(fromDecimalString('650.00'));
    expect(s0.changeSincePriorPnl).toBeNull();
    expect(s0.actionCode).toBe('H');
  });

  it('records Stop overrun and StopDiscipline episode when Held past Stop', () => {
    const model = buildWorkedOpenModel();
    const s1 = model.sessions[1]!;
    expect(s1.stopStatus).toBe('Breached');
    expect(s1.totalPnl).toEqual(fromDecimalString('-401.00'));
    expect(s1.stopOverrun).toEqual(fromDecimalString('100.00'));
    expect(s1.riskToStop).toBeNull();
    expect(s1.changeSincePriorPnl).toEqual(fromDecimalString('-350.00'));
    expect(s1.priorMarkedSessionDate).toBe('2026-11-02');
    expect(model.stopDisciplineEpisodes).toHaveLength(1);
    expect(model.stopDisciplineEpisodes[0]).toMatchObject({
      startSessionDate: '2026-11-03',
      sessionCount: 1,
      maxOverrunDollars: fromDecimalString('-100.00'),
    });
  });

  it('tracks Target reach, overrun, highlightPrimary, and Key Moments on an open Target run', () => {
    const model = buildWorkedOpenModel();
    const s2 = model.sessions[2]!;
    expect(s2.targetStatus).toBe('Reached');
    expect(s2.totalPnl).toEqual(fromDecimalString('699.00'));
    expect(s2.targetOverrun).toEqual(fromDecimalString('100.00'));
    expect(s2.rewardToTarget).toBeNull();
    expect(s2.changeSincePriorPnl).toEqual(fromDecimalString('1100.00'));
    expect(s2.reviewAction.kind).toBe('Pending');
    expect(s2.actionCode).toBe('');
    expect(model.initialSelectedIndex).toBe(2);
    expect(model.highlightPrimary).toBe(true);
    expect(model.keyMoments.map((m) => `${m.sessionDate}:${m.label}`)).toEqual([
      '2026-11-02:Entry',
      '2026-11-03:Low + Stop',
      '2026-11-04:Target + Now',
    ]);
  });

  it('shrinks Stop/Target rails after a profitable partial exit (shifting Stop rail above $0) and widens them again on re-entry Buy', () => {
    // Plan: 100 sh @ $50, Stop $47 (-$300), Target $56 (+$600)
    // Nov 2: Buy 100 @ $50, Mark $52 -> openPnl +$200, atStop -$300, atTarget +$600
    // Nov 3: Sell 60 @ $55 -> realized +$300! Remaining 40 @ $50 -> atStop = 300 + (47-50)*40 = +$180 (ABOVE $0!), atTarget = 300 + (56-50)*40 = +$540
    //        Mark $54 -> openPnl = (54-50)*40 = +$160, totalPnl = +$460, bankedPart = +$300
    // Nov 4: Buy 40 @ $53 -> FIFO lots: 40@$50 + 40@$53 = 80 @ $51.50; atStop = 300 + (47-51.50)*80 = 300 - 360 = -$60; atTarget = 300 + (56-51.50)*80 = +$660
    const model = replayLongStockTrade({
      tradeId: 'trd-scale',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({
          id: 'b1',
          quantity: '100',
          fillPrice: '50.00',
          economicTime: '2026-11-02T15:00:00.000Z',
          recordedSequence: 2,
        }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '60',
          fillPrice: '55.00',
          economicTime: '2026-11-03T15:00:00.000Z',
          recordedSequence: 3,
        }),
        makeExecution({
          id: 'b2',
          side: 'Buy',
          quantity: '40',
          fillPrice: '53.00',
          economicTime: '2026-11-04T15:00:00.000Z',
          recordedSequence: 4,
        }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('52.00') },
        { sessionDate: '2026-11-03', price: ser('54.00') },
        { sessionDate: '2026-11-04', price: ser('53.50') },
      ],
    });

    expect(model.sessions[1]!.realizedPnl).toEqual(fromDecimalString('300'));
    expect(model.sessions[1]!.openShares).toEqual(fromInteger(40));
    expect(model.sessions[1]!.atStopPnl).toEqual(fromDecimalString('180'));
    expect(model.sessions[1]!.atTargetPnl).toEqual(fromDecimalString('540'));
    expect(model.sessions[1]!.bankedPart).toEqual(fromDecimalString('300'));
    expect(model.sessions[1]!.riskToStop).toEqual(fromDecimalString('280'));

    expect(model.sessions[2]!.openShares).toEqual(fromInteger(80));
    expect(model.sessions[2]!.atStopPnl).toEqual(fromDecimalString('-60'));
    expect(model.sessions[2]!.atTargetPnl).toEqual(fromDecimalString('660'));
    expect(model.keyMoments.map((m) => `${m.sessionDate}:${m.label}`)).toEqual([
      '2026-11-02:Entry',
      '2026-11-03:Sale',
      '2026-11-04:Buy + Now',
    ]);
  });

  it('finalizes Closed Trade sessions with zero openPnl, null Stop/Target rails, and never-under-water vs drawdown summary', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-closed',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({
          id: 'b1',
          quantity: '100',
          fillPrice: '50.00',
          fee: '1.00',
          economicTime: '2026-11-02T15:00:00.000Z',
          recordedSequence: 2,
        }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '100',
          fillPrice: '56.00',
          fee: '1.00',
          economicTime: '2026-11-03T15:00:00.000Z',
          recordedSequence: 3,
        }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('48.50') },
        { sessionDate: '2026-11-03', price: ser('56.00') },
      ],
    });

    expect(model.isClosed).toBe(true);
    expect(model.highlightPrimary).toBe(false);
    expect(model.initialSelectedIndex).toBe(1);
    const end = model.sessions[1]!;
    expect(end.isClosed).toBe(true);
    expect(end.openShares).toEqual(fromInteger(0));
    expect(end.openPnl).toEqual(fromInteger(0));
    expect(end.realizedPnl).toEqual(fromDecimalString('598'));
    expect(end.totalPnl).toEqual(fromDecimalString('598'));
    expect(end.atStopPnl).toBeNull();
    expect(end.atTargetPnl).toBeNull();
    expect(end.stopStatus).toBe('Closed');
    expect(end.targetStatus).toBe('Closed');
    expect(end.standing).toBe('Closed');
    expect(end.reviewAction.kind).toBe('Closed');
    expect(model.summaryLine).toContain('2 sessions · low -$151.00 on Mon, Nov 2');
    expect(model.keyMoments.map((m) => m.label)).toEqual(['Entry + Low', 'Target + End']);
  });

  it('handles 1-session same-day Open+Closed trades merging Entry + End without Low/High', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-1day-closed',
      symbol: 'AXIO',
      sessions: ['2026-11-02'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({
          id: 'b1',
          quantity: '100',
          fillPrice: '50.00',
          economicTime: '2026-11-02T14:35:00.000Z',
          recordedSequence: 2,
        }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '100',
          fillPrice: '52.00',
          economicTime: '2026-11-02T15:30:00.000Z',
          recordedSequence: 3,
        }),
      ],
      effectiveMarks: [{ sessionDate: '2026-11-02', price: ser('52.00') }],
    });

    expect(model.isClosed).toBe(true);
    expect(model.sessions).toHaveLength(1);
    expect(model.initialSelectedIndex).toBe(0);
    expect(model.summaryLine).toBe('1 session · never under water. See the path.');
    expect(model.keyMoments).toHaveLength(1);
    expect(model.keyMoments[0]?.label).toBe('Entry + End');
  });

  it('handles Closed trade when close-day Mark is missing by keeping realized totalPnl and null Mark', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-closed-nomk',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({
          id: 'b1',
          quantity: '100',
          fillPrice: '50.00',
          economicTime: '2026-11-02T15:00:00.000Z',
          recordedSequence: 2,
        }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '100',
          fillPrice: '53.00',
          economicTime: '2026-11-03T15:00:00.000Z',
          recordedSequence: 3,
        }),
      ],
      effectiveMarks: [{ sessionDate: '2026-11-02', price: ser('51.00') }],
    });

    const end = model.sessions[1]!;
    expect(end.missingMark).toBe(false);
    expect(model.missingMarkCount).toBe(0);
    expect(end.mark).toBeNull();
    expect(end.totalPnl).toEqual(fromInteger(300));
    expect(end.changeSincePriorPnl).toEqual(fromInteger(200));
    expect(end.priorMarkedSessionDate).toBe('2026-11-02');
  });

  it('handles 1-session and zero-Mark Open trades with valid rails and explicit Unmarked status', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-nomarks',
      symbol: 'AXIO',
      sessions: ['2026-11-02'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [],
      acknowledgedUnavailableDates: ['2026-11-02'],
    });

    expect(model.missingMarkCount).toBe(1);
    expect(model.summaryLine).toBe('1 session · no Marks yet. See the path.');
    const s0 = model.sessions[0]!;
    expect(s0.missingMark).toBe(true);
    expect(s0.unavailableAcknowledged).toBe(true);
    expect(s0.totalPnl).toBeNull();
    expect(s0.atStopPnl).toEqual(fromInteger(-300));
    expect(s0.atTargetPnl).toEqual(fromInteger(600));
    expect(s0.standing).toBe('Unmarked');
    expect(model.keyMoments.map((m) => m.label)).toEqual(['Entry + Now']);
    expect(model.keyMoments[0]?.text).toContain('A Mark is missing.');
  });

  it('enforces strict Stop === Mark and Target === Mark boundary rules', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-bounds',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('47.00') },
        { sessionDate: '2026-11-03', price: ser('56.00') },
      ],
    });

    expect(model.sessions[0]!.stopStatus).toBe('Breached');
    expect(model.sessions[0]!.stopOverrun).toEqual(fromInteger(0));
    expect(model.sessions[0]!.standing).toBe('PastStop');

    expect(model.sessions[1]!.targetStatus).toBe('Reached');
    expect(model.sessions[1]!.targetOverrun).toEqual(fromInteger(0));
    expect(model.sessions[1]!.standing).toBe('AtTarget');
  });

  it('preserves >4-decimal exact Rational quantities, lot-aware fees, and $0.00 breakeven P&L', () => {
    // 10.12345 sh @ $50.00, fee $0 -> Mark $50.00 gives exact 0n breakeven; Mark $52.00 gives exact 20.2469 (202469/10000)
    const model = replayLongStockTrade({
      tradeId: 'trd-rat',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan({ plannedQuantity: '10.12345' }),
      originalPlannedRisk: ser('30.37035'),
      executions: [makeExecution({ quantity: '10.12345', fillPrice: '50.00', fee: '0.00' })],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('50.00') },
        { sessionDate: '2026-11-03', price: ser('52.00') },
      ],
    });

    expect(model.sessions[0]!.openShares).toEqual({ num: 202469n, den: 20000n });
    expect(model.sessions[0]!.totalPnl).toEqual(fromInteger(0));
    expect(toMoneyString(model.sessions[0]!.totalPnl!)).toBe('$0.00');
    expect(model.sessions[1]!.totalPnl).toEqual({ num: 202469n, den: 10000n });
    expect(model.sessions[1]!.totalPnlDisplay).toBe('+$20.25');
  });

  it.each([
    {
      label: 'realized+ & pnl+ -> min(realized, pnl)',
      sellPrice: '55.00', // realized on 50 sh = +250
      markPrice: '52.00', // open on 50 sh = +100 -> total +350
      expectedBanked: '250.00',
    },
    {
      label: 'realized+ & pnl- -> $0',
      sellPrice: '52.00', // realized on 50 sh = +100
      markPrice: '46.00', // open on 50 sh = -200 -> total -100
      expectedBanked: '0',
    },
    {
      label: 'realized- & pnl+ -> $0',
      sellPrice: '48.00', // realized on 50 sh = -100
      markPrice: '54.00', // open on 50 sh = +200 -> total +100
      expectedBanked: '0',
    },
    {
      label: 'realized- & pnl- (total deeper than realized) -> max(realized, pnl) = realized',
      sellPrice: '48.00', // realized = -100
      markPrice: '47.00', // open = -150 -> total -250
      expectedBanked: '-100.00',
    },
    {
      label: 'realized- & pnl- (total shallower than realized) -> max(realized, pnl) = total',
      sellPrice: '46.00', // realized = -200
      markPrice: '52.00', // open = +100 -> total -100
      expectedBanked: '-100.00',
    },
  ])('computes bankedPart sign rule: $label', ({ sellPrice, markPrice, expectedBanked }) => {
    const model = replayLongStockTrade({
      tradeId: 'trd-bank',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00' }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '50',
          fillPrice: sellPrice,
          economicTime: '2026-11-03T15:00:00.000Z',
          recordedSequence: 3,
        }),
      ],
      effectiveMarks: [{ sessionDate: '2026-11-03', price: ser(markPrice) }],
    });

    expect(model.sessions[1]!.bankedPart).toEqual(fromDecimalString(expectedBanked));
  });

  it('applies High (> end + 0.25R) and Low suppression Key Moment rules and jumps initialSelectedIndex to first Stop breach', () => {
    // 1R = $300 -> 0.25R = $75.
    // Nov 2: $54 (+$400) -> High!
    // Nov 3: $46 (-$400, first Stop breach)
    // Nov 4: $45 (-$500, still PastStop; since endRes (-500) <= Nov 3 (-400), Low on Nov 3 is suppressed!)
    const model = replayLongStockTrade({
      tradeId: 'trd-km',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('54.00') },
        { sessionDate: '2026-11-03', price: ser('46.00') },
        { sessionDate: '2026-11-04', price: ser('45.00') },
      ],
    });

    expect(model.initialSelectedIndex).toBe(1);
    expect(model.keyMoments.map((m) => `${m.sessionDate}:${m.label}`)).toEqual([
      '2026-11-02:Entry + High',
      '2026-11-03:Stop',
      '2026-11-04:Now',
    ]);
  });

  it('omits High Key Moment when peak excess is at or below 0.25R above end result', () => {
    const noHigh = replayLongStockTrade({
      tradeId: 'trd-nohi',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('54.00') }, // +400
        { sessionDate: '2026-11-03', price: ser('53.50') }, // +350
      ],
    });
    expect(noHigh.keyMoments.map((m) => `${m.sessionDate}:${m.label}`)).toEqual([
      '2026-11-02:Entry',
      '2026-11-03:Now',
    ]);
  });

  it('jumps initialSelectedIndex to firstTargetIndex when an Open Trade is AtTarget across multiple sessions', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-tgt-jump',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('51.00') },
        { sessionDate: '2026-11-03', price: ser('56.50') }, // first Target reach (index 1)
        { sessionDate: '2026-11-04', price: ser('57.50') }, // still AtTarget
      ],
    });

    expect(model.initialSelectedIndex).toBe(1);
    expect(model.highlightPrimary).toBe(true);
    expect(model.summaryLine).toContain('At the Target since');
  });

  it('summarizes multiple same-day closing sells cleanly in the End Key Moment', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-multisell',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({
          id: 'b1',
          quantity: '100',
          fillPrice: '50.00',
          economicTime: '2026-11-02T15:00:00.000Z',
          recordedSequence: 2,
        }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '40',
          fillPrice: '54.00',
          economicTime: '2026-11-03T14:30:00.000Z',
          recordedSequence: 3,
        }),
        makeExecution({
          id: 's2',
          side: 'Sell',
          quantity: '60',
          fillPrice: '56.00',
          economicTime: '2026-11-03T15:45:00.000Z',
          recordedSequence: 4,
        }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('51.00') },
        { sessionDate: '2026-11-03', price: ser('56.00') },
      ],
    });

    const endMoment = model.keyMoments.find((m) => m.kinds.includes('End'));
    expect(endMoment?.text).toContain('Sold 40 at $54.00, 60 at $56.00.');
    expect(endMoment?.text).toContain('+$520.00');
  });

  it('preserves leading, interior, and partial-sale-day Mark gaps without interpolation while skipping gaps in daily change', () => {
    // Nov 2: Buy 100 @ 50 (NO MARK -> leading gap)
    // Nov 3: Mark $52 -> openPnl +$200, changeSincePriorPnl null
    // Nov 4: Sell 50 @ $54 (+$200 realized), NO MARK -> openPnl null, totalPnl null, atStop/atTarget rails STILL shrink!
    // Nov 5: NO MARK (2nd consecutive gap)
    // Nov 6: Mark $55 -> openPnl (55-50)*50 = +250, totalPnl = +450, changeSincePrior = +450 - 200 = +250 since Tue Nov 3!
    const model = replayLongStockTrade({
      tradeId: 'trd-gaps',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'],
      reviewDate: '2026-11-06',
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({
          id: 'b1',
          quantity: '100',
          fillPrice: '50.00',
          economicTime: '2026-11-02T15:00:00.000Z',
          recordedSequence: 2,
        }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '50',
          fillPrice: '54.00',
          economicTime: '2026-11-04T15:00:00.000Z',
          recordedSequence: 3,
        }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-03', price: ser('52.00') },
        { sessionDate: '2026-11-06', price: ser('55.00') },
      ],
      acknowledgedUnavailableDates: ['2026-11-04'],
      reviewActions: [{ reviewDate: '2026-11-03', action: 'Hold', reason: null, conviction: null }],
    });

    expect(model.missingMarkCount).toBe(3);

    expect(model.sessions[0]!.missingMark).toBe(true);
    expect(model.sessions[0]!.totalPnl).toBeNull();
    expect(model.sessions[0]!.reviewAction.kind).toBe('NoReview');
    expect(model.sessions[0]!.actionCode).toBe('–');

    expect(model.sessions[1]!.totalPnl).toEqual(fromInteger(200));
    expect(model.sessions[1]!.changeSincePriorPnl).toBeNull();
    expect(model.sessions[1]!.priorMarkedSessionDate).toBeNull();

    expect(model.sessions[2]!.missingMark).toBe(true);
    expect(model.sessions[2]!.unavailableAcknowledged).toBe(true);
    expect(model.sessions[2]!.realizedPnl).toEqual(fromInteger(200));
    expect(model.sessions[2]!.openPnl).toBeNull();
    expect(model.sessions[2]!.totalPnl).toBeNull();
    expect(model.sessions[2]!.atStopPnl).toEqual(fromInteger(50)); // 200 + (47-50)*50 = +50
    expect(model.sessions[2]!.atTargetPnl).toEqual(fromInteger(500)); // 200 + (56-50)*50 = +500

    expect(model.sessions[3]!.missingMark).toBe(true);
    expect(model.sessions[3]!.unavailableAcknowledged).toBe(false);
    expect(model.sessions[3]!.totalPnl).toBeNull();

    expect(model.sessions[4]!.totalPnl).toEqual(fromInteger(450));
    expect(model.sessions[4]!.changeSincePriorPnl).toEqual(fromInteger(250));
    expect(model.sessions[4]!.priorMarkedSessionDate).toBe('2026-11-03');
  });

  it('orders out-of-order and same-day executions by EconomicTime then RecordedSequence', () => {
    // Passed in reverse order!
    const model = replayLongStockTrade({
      tradeId: 'trd-order',
      symbol: 'AXIO',
      sessions: ['2026-11-02'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({
          id: 's-late',
          side: 'Sell',
          quantity: '40',
          fillPrice: '53.00',
          economicTime: '2026-11-02T15:00:00.000Z',
          recordedSequence: 4,
        }),
        makeExecution({
          id: 'b-tie2',
          side: 'Buy',
          quantity: '50',
          fillPrice: '51.00',
          economicTime: '2026-11-02T14:35:00.000Z',
          recordedSequence: 3,
        }),
        makeExecution({
          id: 'b-tie1',
          side: 'Buy',
          quantity: '50',
          fillPrice: '49.00',
          economicTime: '2026-11-02T14:35:00.000Z',
          recordedSequence: 2,
        }),
      ],
      effectiveMarks: [{ sessionDate: '2026-11-02', price: ser('52.00') }],
    });

    // FIFO sells 40 from b-tie1 ($49) at $53 -> realized +160; remaining: 10@$49 + 50@$51 -> open cost = 3040; at $52 -> 60*52 - 3040 = +80; total = +240
    expect(model.sessions[0]!.realizedPnl).toEqual(fromInteger(160));
    expect(model.sessions[0]!.openPnl).toEqual(fromInteger(80));
    expect(model.sessions[0]!.totalPnl).toEqual(fromInteger(240));
    expect(model.sessions[0]!.executionsToday.map((e) => e.id)).toEqual([
      'b-tie1',
      'b-tie2',
      's-late',
    ]);
  });

  it('rejects empty sessions or empty executions explicitly', () => {
    expect(() =>
      replayLongStockTrade({
        tradeId: 'trd-empty',
        symbol: 'AXIO',
        sessions: [],
        plan: makeLongStockPlan(),
        originalPlannedRisk: ser('300.00'),
        executions: [makeExecution()],
        effectiveMarks: [],
      }),
    ).toThrow(/at least one session and one execution/);

    expect(() =>
      replayLongStockTrade({
        tradeId: 'trd-empty2',
        symbol: 'AXIO',
        sessions: ['2026-11-02'],
        plan: makeLongStockPlan(),
        originalPlannedRisk: ser('300.00'),
        executions: [],
        effectiveMarks: [],
      }),
    ).toThrow(/at least one session and one execution/);
  });

  it('normalizes trimmed reason, null blanks, conviction, and recordedAt in extractReplayReviewActions', () => {
    const entries = [
      makeReviewActionEntry({
        id: 'dtr-hold',
        tradeId: 'trd-ext',
        reviewDate: '2026-11-02',
        action: 'Hold',
        reason: '   ',
        recordedAt: '2026-11-02T22:00:00.000Z',
      }),
      makeReviewActionEntry({
        id: 'dtr-exit',
        tradeId: 'trd-ext',
        reviewDate: '2026-11-03',
        action: 'Exit',
        reason: '  Hit resistance  ',
        conviction: 5,
        recordedAt: '2026-11-03T22:00:00.000Z',
      }),
    ];
    const extracted = extractReplayReviewActions(entries, DAILY_TRADE_REVIEW_TYPE_ID);
    expect(extracted).toEqual([
      {
        reviewDate: '2026-11-02',
        action: 'Hold',
        reason: null,
        conviction: null,
        recordedAt: '2026-11-02T22:00:00.000Z',
      },
      {
        reviewDate: '2026-11-03',
        action: 'Exit',
        reason: 'Hit resistance',
        conviction: 5,
        recordedAt: '2026-11-03T22:00:00.000Z',
      },
    ]);
  });

  it('projects Hold -> H and Exit -> E action codes onto ReplaySessionPoints', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-ext',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('50.50') },
        { sessionDate: '2026-11-03', price: ser('51.00') },
      ],
      reviewActions: [
        { reviewDate: '2026-11-02', action: 'Hold', reason: null, conviction: null },
        { reviewDate: '2026-11-03', action: 'Exit', reason: 'Hit resistance', conviction: 5 },
      ],
    });
    expect(model.sessions.map((s) => s.actionCode)).toEqual(['H', 'E']);
  });

  it('emits "Sold the last ..." End moment text on a closing single-sell session', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-end-single',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00' }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '100',
          fillPrice: '56.00',
          economicTime: '2026-11-03T15:00:00.000Z',
          recordedSequence: 3,
        }),
      ],
      effectiveMarks: [{ sessionDate: '2026-11-02', price: ser('52.00') }],
    });
    const endMoment = model.keyMoments.find((m) => m.kinds.includes('End'));
    expect(endMoment?.text).toBe('Sold the last 100 at $56.00. Result +$600.00 (+2.00R).');
  });

  it('does not report stale PastStop summary or highlightPrimary when the end session Mark is missing after an earlier Stop breach', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-trailing-gap',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04'],
      reviewDate: '2026-11-04',
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('49.00') },
        { sessionDate: '2026-11-03', price: ser('46.00') },
      ],
      reviewActions: [
        { reviewDate: '2026-11-02', action: 'Hold', reason: null, conviction: null },
        { reviewDate: '2026-11-03', action: 'Hold', reason: 'Holding', conviction: 3 },
      ],
    });

    expect(model.highlightPrimary).toBe(false);
    expect(model.summaryLine).toContain('Mark missing');
    expect(model.summaryLine).not.toMatch(/^Past the Stop since/);
    expect(model.initialSelectedIndex).toBe(2);
    expect(model.keyMoments.find((m) => m.kinds.includes('Now'))?.text).toBe('A Mark is missing.');
  });

  it('jumps initialSelectedIndex to the start of the current Stop breach run after an earlier recovery', () => {
    // Breach #1 on Nov 3 ($46.50), recovered on Nov 4 ($48.50), Breach #2 on Nov 5 ($46.00) & Nov 6 ($45.50)
    const model = replayLongStockTrade({
      tradeId: 'trd-second-breach',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'],
      reviewDate: '2026-11-06',
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('49.00') },
        { sessionDate: '2026-11-03', price: ser('46.50') },
        { sessionDate: '2026-11-04', price: ser('48.50') },
        { sessionDate: '2026-11-05', price: ser('46.00') },
        { sessionDate: '2026-11-06', price: ser('45.50') },
      ],
    });

    expect(model.initialSelectedIndex).toBe(3); // Nov 5 (current run start), not Nov 3 (recovered)
    expect(model.summaryLine).toContain('Past the Stop since Thu, Nov 5');
  });

  it('marks oversold sessions explicitly as Oversold instead of Unmarked even when a Mark exists', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-oversold',
      symbol: 'AXIO',
      sessions: ['2026-11-02'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00' }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '120',
          fillPrice: '52.00',
          economicTime: '2026-11-02T15:30:00.000Z',
          recordedSequence: 3,
        }),
      ],
      effectiveMarks: [{ sessionDate: '2026-11-02', price: ser('51.00') }],
    });

    expect(model.sessions[0]!.standing).toBe('Oversold');
    expect(model.keyMoments.find((m) => m.kinds.includes('Now'))?.text).toContain('oversold');
  });

  it('resolves duplicate reviewActions on the same reviewDate deterministically for both actions and StopDiscipline episodes', () => {
    const actionsA = [
      {
        reviewDate: '2026-11-02',
        action: 'Hold' as const,
        reason: 'Earlier',
        conviction: 3,
        recordedAt: '2026-11-02T22:00:00.000Z',
      },
      {
        reviewDate: '2026-11-02',
        action: 'Exit' as const,
        reason: 'Updated later',
        conviction: 5,
        recordedAt: '2026-11-02T22:05:00.000Z',
      },
    ];
    const forward = replayLongStockTrade({
      tradeId: 'trd-dup-act',
      symbol: 'AXIO',
      sessions: ['2026-11-02'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [{ sessionDate: '2026-11-02', price: ser('46.00') }],
      reviewActions: actionsA,
    });
    const reversed = replayLongStockTrade({
      tradeId: 'trd-dup-act',
      symbol: 'AXIO',
      sessions: ['2026-11-02'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [{ sessionDate: '2026-11-02', price: ser('46.00') }],
      reviewActions: [...actionsA].reverse(),
    });
    expect(reversed).toEqual(forward);
    expect(forward.sessions[0]!.actionCode).toBe('E');
    expect(forward.stopDisciplineEpisodes).toEqual([]);
  });

  it('breaks trailing Stop breach streak and initialSelectedIndex at a missing-Mark gap instead of bridging across it', () => {
    // Breach #1 on Nov 3 ($46.50), missing Mark on Nov 4, Breach #2 on Nov 5 ($46.00)
    const model = replayLongStockTrade({
      tradeId: 'trd-gap-streak',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
      reviewDate: '2026-11-05',
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('49.00') },
        { sessionDate: '2026-11-03', price: ser('46.50') },
        { sessionDate: '2026-11-05', price: ser('46.00') },
      ],
    });

    expect(model.initialSelectedIndex).toBe(3); // Starts at post-gap Nov 5, not Nov 3
    expect(model.summaryLine).toContain('Past the Stop since Thu, Nov 5 · 1 session');
  });

  it('formats unsigned Up/Down magnitudes consistently in Now Key Moment text', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-now-up',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('49.00') },
        { sessionDate: '2026-11-03', price: ser('52.50') },
      ],
    });
    const nowText = model.keyMoments.find((m) => m.kinds.includes('Now'))?.text ?? '';
    expect(nowText).toContain('Up $350.00 since Mon, Nov 2.');
    expect(nowText).not.toContain('Up +$');
  });

  it('ignores flat intermediate closed sessions when finding Stop/Target breach moments after re-entry', () => {
    // Nov 2 buy 100 @ 50 -> Nov 3 sell 100 @ 51 -> Nov 4 closed/flat with Mark 46 (<= 47 Stop) -> Nov 5 re-enter buy 50 @ 50, Mark 49
    const model = replayLongStockTrade({
      tradeId: 'trd-reenter',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00', economicTime: '2026-11-02T15:00:00.000Z', recordedSequence: 2 }),
        makeExecution({ id: 's1', side: 'Sell', quantity: '100', fillPrice: '51.00', economicTime: '2026-11-03T15:00:00.000Z', recordedSequence: 3 }),
        makeExecution({ id: 'b2', quantity: '50', fillPrice: '50.00', economicTime: '2026-11-05T15:00:00.000Z', recordedSequence: 4 }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('50.50') },
        { sessionDate: '2026-11-03', price: ser('51.00') },
        { sessionDate: '2026-11-04', price: ser('46.00') },
        { sessionDate: '2026-11-05', price: ser('49.00') },
      ],
    });

    expect(model.keyMoments.some((m) => m.kinds.includes('Stop'))).toBe(false);
  });

  it('emits Stop Key Moment when a trade closes at or below Stop on its final exit session', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-close-stop',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00', economicTime: '2026-11-02T15:00:00.000Z', recordedSequence: 2 }),
        makeExecution({ id: 's1', side: 'Sell', quantity: '100', fillPrice: '46.50', economicTime: '2026-11-03T15:30:00.000Z', recordedSequence: 3 }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('49.00') },
        { sessionDate: '2026-11-03', price: ser('46.50') },
      ],
    });

    expect(model.keyMoments.map((m) => m.label)).toEqual(['Entry + Low', 'Stop + End']);
  });

  it('reports closing drawdown rather than never-under-water for 1-session and close-day-only losers', () => {
    const oneDayLoser = replayLongStockTrade({
      tradeId: 'trd-1day-loser',
      symbol: 'AXIO',
      sessions: ['2026-11-02'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00', economicTime: '2026-11-02T14:35:00.000Z', recordedSequence: 2 }),
        makeExecution({ id: 's1', side: 'Sell', quantity: '100', fillPrice: '48.00', economicTime: '2026-11-02T15:30:00.000Z', recordedSequence: 3 }),
      ],
      effectiveMarks: [{ sessionDate: '2026-11-02', price: ser('48.00') }],
    });
    expect(oneDayLoser.summaryLine).toBe('1 session · low -$200.00 on Mon, Nov 2. See the path.');

    const closeDayLoser = replayLongStockTrade({
      tradeId: 'trd-closeday-loser',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00', economicTime: '2026-11-02T15:00:00.000Z', recordedSequence: 2 }),
        makeExecution({ id: 's1', side: 'Sell', quantity: '100', fillPrice: '48.50', economicTime: '2026-11-03T15:30:00.000Z', recordedSequence: 3 }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('51.00') },
        { sessionDate: '2026-11-03', price: ser('48.50') },
      ],
    });
    expect(closeDayLoser.summaryLine).toBe('2 sessions · low -$150.00 on Tue, Nov 3. See the path.');
  });

  it('ignores intraday mark on inProgressSessionDate so standing and Hero remain pending until close', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-inprogress-mark',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      inProgressSessionDate: '2026-11-03',
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00', economicTime: '2026-11-02T15:00:00.000Z', recordedSequence: 2 }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('49.50') },
        { sessionDate: '2026-11-03', price: ser('45.00') },
      ],
    });

    const live = model.sessions[1]!;
    expect(live.inProgress).toBe(true);
    expect(live.mark).toBeNull();
    expect(live.totalPnl).toBeNull();
    expect(live.standing).toBe('Unmarked');
    expect(model.highlightPrimary).toBe(false);
    expect(model.initialSelectedIndex).toBe(1);
    expect(model.keyMoments.find((m) => m.kinds.includes('Now'))?.text).toBe(
      "Session still open — waiting for today's close.",
    );
  });

  it('keeps pre-entry sessions non-missingMark via assembleLongStockReplayInput and omits R displays when oneR <= 0', () => {
    const input = assembleLongStockReplayInput({
      tradeId: 'trd-zero-r',
      symbol: 'AXIO',
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('0'),
      originalPlannedReward: ser('0'),
      sortedExecutions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00', economicTime: '2026-11-03T15:00:00.000Z', recordedSequence: 2 }),
      ],
      sessions: ['2026-11-02', '2026-11-03'],
      cutoffDate: '2026-11-03',
      effectiveMarks: [{ sessionDate: '2026-11-03', price: ser('51.00') }],
      acknowledgedUnavailableDates: [],
      reviewActions: [],
    });
    const model = replayLongStockTrade(input);
    expect(model.sessions[0]!.hasEntered).toBe(false);
    expect(model.sessions[0]!.missingMark).toBe(false);
    expect(model.missingMarkCount).toBe(0);
    expect(model.sessions[1]!.totalPnlR).toBeNull();
    expect(model.sessions[1]!.totalPnlRDisplay).toBeNull();
  });
});
