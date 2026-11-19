import { describe, expect, it } from 'vitest';
import { replayProps } from './replay.props.ts';
import {
  AXIO, BREN, BREN_STOCK, brenThu1112, brenWed1111, DALE, frac, fullView, markOf, NOT_APPLICABLE, Plot, PLAN, readoutOf, rowNamed, rowsOfGroup, session, stakeRows, UNBOUNDED, usd, value, view, withMarks,
} from './view-doubles.props.ts';

describe('replay.props: the readout of a session in flight (W43)', () => {
  it('should name the overrun in place of the risk or the reward once past a line, add what is banked, and say Stop breached or Target reached', () => {
    const pastStop = session({
      date: '2026-11-09',
      instrument: AXIO,
      held: 100,
      pnl: -920,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(180), r: frac(3, 10), crossed: true } }),
      figures: { ongoingRiskToStop: value(usd(0)), incrementalRewardToTarget: value(usd(1080)) },
    });
    const stopRows = rowsOfGroup(replayProps(view([pastStop]), { Plot }), 0, 'At stake from here, whole Position');
    expect(stopRows).toMatchObject({ 'Stop Overrun': '$180.00 · 0.30R', 'At Target': '$1,080.00', 'Reward to risk': 'Stop breached' });
    expect(stopRows).not.toHaveProperty('At Stop');
    // Past the Target with 2 of 4 contracts sold: the sale's +$478 is banked.
    const pastTarget = session({
      date: '2026-11-13',
      held: 2,
      pnl: 1138,
      realized: 478,
      standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(182), r: frac(182, 324), crossed: true } }),
      figures: { ongoingRiskToStop: value(usd(672)), incrementalRewardToTarget: value(usd(0)) },
    });
    const props = replayProps(view([pastTarget]), { Plot });
    const targetRows = rowsOfGroup(props, 0, 'At stake from here, whole Position');
    expect(targetRows).toMatchObject({ 'At Stop': '$672.00', 'Target Overrun': '$182.00 · 0.56R', 'Reward to risk': 'Target reached' });
    expect(targetRows).not.toHaveProperty('At Target');
    expect(rowsOfGroup(props, 0, 'How it is going')).toEqual({ 'Trade P&L': '+$1,138.00', Banked: '+$478.00' });
  });

  it('should show the open part of the Trade P&L in the readout', () => {
    // 2 of 4 contracts sold for +$478 banked; the 2 held are open +$660 of the +$1,138.
    const props = replayProps(view([session({ date: '2026-11-13', held: 2, pnl: 1138, realized: 478, open: 660 })]), { Plot });
    expect(rowsOfGroup(props, 0, 'How it is going')).toEqual({ 'Trade P&L': '+$1,138.00', Banked: '+$478.00', Open: '+$660.00' });
  });

  it('should call a planned-amount overrun by its words, not a breach, when the condition has not triggered', () => {
    const untriggered = (zone: 'PastStop' | 'PastTarget') =>
      rowsOfGroup(
        replayProps(view([session({ date: '2026-11-12', instrument: DALE, held: -3, pnl: -1272, standing: value({ zone, pastBy: { dollars: usd(9), r: frac(9, 1536), crossed: false } }) })]), { Plot }),
        0,
        'At stake from here, whole Position',
      );
    const stopRows = untriggered('PastStop');
    expect(stopRows).toMatchObject({ "Past Stop's amount": '$9.00 · 0.01R', 'Reward to risk': 'Not triggered' });
    expect(stopRows).not.toHaveProperty('Stop Overrun');
    const targetRows = untriggered('PastTarget');
    expect(targetRows).toMatchObject({ "Past Target's amount": '$9.00 · 0.01R', 'Reward to risk': 'Not triggered' });
    expect(targetRows).not.toHaveProperty('Target Overrun');
  });

  it('should show Final result with the Execution on a final session, and No Mark in place of the stake and the Marks on a session without one', () => {
    const sale = { id: 'x2', kind: 'Execution', effect: 'Closed', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
    const final = { ...withMarks(session({ date: '2026-11-13', held: 0, pnl: 1260, realized: 1260, standing: NOT_APPLICABLE, final: { kind: 'Sold' } }), [markOf(BREN_STOCK, '104.60'), markOf(BREN)]), markers: [sale] };
    const props = replayProps(fullView([final], PLAN), { Plot });
    expect(props.sessions[0]!.readout.map((group) => group.title)).toEqual(['Final result', 'Marks', 'Position', 'The Plan']);
    expect(rowsOfGroup(props, 0, 'Final result')).toEqual({ 'Trade P&L': '+$1,260.00', Banked: '+$1,260.00' });
    expect(rowsOfGroup(props, 0, 'Position')).toEqual({ 'Execution, Fri Nov 13': 'Sold 2 at $4.00' });
    // A Mark that was never saved reads "No Mark"; nothing is carried over.
    const none = withMarks(session({ date: '2026-11-10', pnl: null }), [markOf(BREN_STOCK, '100.20'), markOf(BREN)]);
    const gap = replayProps(fullView([none], PLAN), { Plot });
    expect(gap.sessions[0]!.readout.map((group) => group.title)).toEqual(['How it is going', 'Marks', 'Position', 'The Plan']);
    expect(rowsOfGroup(gap, 0, 'Marks')).toEqual({ 'BREN Mark': '100.20', 'Call Mark': 'No Mark' });
    expect(rowsOfGroup(gap, 0, 'How it is going')).toEqual({ 'Trade P&L': 'Mark missing: BREN Nov 20 $100 Call, Tue Nov 10' });
  });

  it('should keep At Worst case standing and At Max reward bounded or No cap above on a session without a Mark', () => {
    // Short put (DALE): the Max reward is bounded, so its amount stands beside "No Mark" for Stop and Target; the Trade's result at each stands too.
    const dale = session({
      date: '2026-11-12',
      instrument: DALE,
      held: -3,
      pnl: null,
      figures: {
        worstCaseOngoingRisk: value(usd(4520)),
        worstCaseOngoingRiskInPlanR: value(frac(4520, 1536)),
        maximumIncrementalReward: value(usd(464)),
        maximumIncrementalRewardInPlanR: value(frac(464, 1536)),
      },
      outcomes: { atStop: value(usd(-543)), atTarget: value(usd(1284)), atWorstCase: value(usd(-4520)), atMaxReward: value(usd(564)) },
    });
    const bounded = replayProps(view([dale]), { Plot });
    expect(rowNamed(bounded, 0, 'At Stop')).toMatchObject({ value: { text: 'No Mark' } });
    expect(rowNamed(bounded, 0, 'At Worst case')).toMatchObject({ value: { kind: 'Figure', text: '$4,520.00 · 2.94R' }, pnl: { kind: 'Figure', text: '−$4,520.00' } });
    expect(rowNamed(bounded, 0, 'At Max reward')).toMatchObject({ value: { kind: 'Figure', text: '$464.00 · 0.30R' }, pnl: { kind: 'Figure', text: '+$564.00' } });
    // Long call (BREN): nothing caps the reward above, and there is no result to show there.
    const none = withMarks(session({ date: '2026-11-10', pnl: null, figures: { worstCaseOngoingRisk: value(usd(644)), worstCaseOngoingRiskInPlanR: value(frac(644, 324)), maximumIncrementalReward: UNBOUNDED }, outcomes: { atStop: value(usd(-324)), atTarget: value(usd(956)), atWorstCase: value(usd(-644)) } }), [markOf(BREN_STOCK, '100.20'), markOf(BREN)]);
    const long = replayProps(fullView([none], PLAN), { Plot });
    expect(rowNamed(long, 0, 'At Worst case')).toMatchObject({ value: { kind: 'Figure', text: '$644.00 · 1.99R' }, pnl: { kind: 'Figure', text: '−$644.00' } });
    const unbounded = rowNamed(long, 0, 'At Max reward')!;
    expect(unbounded.value).toEqual({ kind: 'Unbounded', text: 'No cap above' });
    expect(unbounded.pnl).toBeUndefined();
  });

  it('should group How it is going, At stake from here, Marks, Position and The Plan, each figure finished, with its change since the earlier session', () => {
    const props = replayProps(fullView([brenWed1111], PLAN), { Plot });
    expect(readoutOf(props, 0)).toEqual([
      ['How it is going', [['Trade P&L', 'Figure', '+$520.00 · 1.60R', 'up $190.00 since Tue Nov 10']]],
      [
        'At stake from here, whole Position',
        [
          ['At Stop', 'Figure', '$352.00 · 1.09R', 'down $60.00 since Tue Nov 10'],
          ['At Worst case', 'Figure', '$644.00 · 1.99R', undefined],
          ['At Target', 'Figure', '$928.00 · 2.86R', 'up $60.00 since Tue Nov 10'],
          ['At Max reward', 'Unbounded', 'No cap above', undefined],
          ['Reward to risk', 'Figure', '2.64 to 1', '(Plan 2.95 to 1)'],
        ],
      ],
      [
        'Marks',
        [
          ['BREN Mark', 'Figure', '101.80', 'up 1.60 since Tue Nov 10'],
          ['Call Mark', 'Figure', '$3.20', 'down $0.40 since Tue Nov 10'],
        ],
      ],
      ['Position', [['Held', 'Figure', '4 contracts', undefined]]],
      [
        'The Plan',
        [
          // Named apart from the session's own results above, so each label stands once in the drawer.
          ['At the Stop', 'Figure', '−$324.00', undefined],
          ['At the Target', 'Figure', '+$956.00', undefined],
        ],
      ],
    ]);
  });
});

// R-BREN-U on Thu 11-12 is `brenThu1112` in the shared doubles.
describe('replay.props: the readout separates what is at stake from where the Trade ends (T9.19-B4)', () => {
  it('should head Current Risk and Remaining Reward, and give At Stop and At Worst case their amount and their P&L, with none of the six old row names', () => {
    const props = replayProps(fullView([brenThu1112], PLAN), { Plot });
    const rows = stakeRows(props, 0);
    expect(rows.filter((r) => r.heading).map((r) => [r.heading, r.label])).toEqual([['Current Risk', 'At Stop'], ['Remaining Reward', 'Target Overrun']]);
    expect(rowNamed(props, 0, 'At Stop')).toMatchObject({ value: { kind: 'Figure', text: '$672.00 · 2.07R' }, pnl: { kind: 'Figure', text: '+$316.00' } });
    expect(rowNamed(props, 0, 'At Worst case')).toMatchObject({ value: { kind: 'Figure', text: '$832.00 · 2.57R' }, pnl: { kind: 'Figure', text: '+$156.00' } });
    // The overrun stands in the place of "At Target", and the Trade's result at the Target stays beside it.
    expect(rowNamed(props, 0, 'Target Overrun')).toMatchObject({ value: { text: '$26.00 · 0.08R' }, pnl: { text: '+$956.00' } });
    const labels = rows.map((r) => r.label);
    for (const old of ['Risk to stop', 'Result at the Stop', 'Worst case', 'Reward to target', 'Result at the Target', 'Max reward']) expect(labels).not.toContain(old);
  });

  it('should give At Max reward its amount and P&L for a short put, and No cap above with no P&L for a long call', () => {
    const dale = session({
      date: '2026-11-12',
      instrument: DALE,
      held: -3,
      pnl: 100,
      standing: value({ zone: 'Between', share: frac(1, 10) }),
      figures: {
        ongoingRiskToStop: value(usd(543)),
        incrementalRewardToTarget: value(usd(1284)),
        maximumIncrementalReward: value(usd(464)),
        maximumIncrementalRewardInPlanR: value(frac(464, 1536)),
      },
      outcomes: { atMaxReward: value(usd(564)) },
    });
    const props = replayProps(view([dale]), { Plot });
    expect(rowNamed(props, 0, 'At Max reward')).toMatchObject({ value: { kind: 'Figure', text: '$464.00 · 0.30R' }, pnl: { kind: 'Figure', text: '+$564.00' } });
    const long = replayProps(fullView([brenThu1112], PLAN), { Plot });
    const unbounded = rowNamed(long, 0, 'At Max reward')!;
    expect(unbounded.value).toEqual({ kind: 'Unbounded', text: 'No cap above' });
    expect(unbounded.pnl).toBeUndefined();
  });
});
