import { describe, expect, it } from 'vitest';
import type { Instrument } from '../../../domain/instrument/index.ts';
import { replayProps } from './replay.props.ts';
import { sessionWords } from './session-words.props.ts';
import {
  AXIO, BREN, BREN_STOCK, brenThu1112, brenWed1111, DALE, DALE_PLAN, daleWed1111, frac, fullView, markOf, NO_TERMS, NOT_APPLICABLE, odds, Plot, PLAN, readoutOf, rowNamed, rowsOfGroup, session, STAKE, UNBOUNDED, usd, value, view, withMarks,
} from './view-doubles.props.ts';

describe('replay.props: the readout of a session in flight (W43)', () => {
  it('should name the overrun in one row in place of the risk or the reward once past a line, and add what is banked', () => {
    const pastStop = session({
      date: '2026-11-09',
      instrument: AXIO,
      held: 100,
      pnl: -920,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(180), r: frac(3, 10), crossed: true } }),
      figures: { ongoingRiskToStop: value(usd(0)), incrementalRewardToTarget: value(usd(1080)) },
    });
    const stopGrid = gridOf(replayProps(view([pastStop]), { Plot }), 0);
    expect(stopGrid.pastLine?.text).toMatch(/^Past the Stop by \$180\.00 \(0\.30R\)/);
    expect(cellsOf(stopGrid, 'At Target')[0]).toBe('$1,080.00');
    expect(labelsOf(stopGrid).flat()).not.toContain('At Stop');
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
    const targetGrid = gridOf(props, 0);
    expect(targetGrid.pastLine?.text).toMatch(/^Past the Target by \$182\.00 \(0\.56R\)/);
    expect(cellsOf(targetGrid, 'At Stop')[0]).toBe('$672.00');
    expect(labelsOf(targetGrid).flat()).not.toContain('At Target');
    expect(rowsOfGroup(props, 0, 'How it is going')).toEqual({ 'Trade P&L': '+$1,138.00', Banked: '+$478.00' });
  });

  it('should show the open part of the Trade P&L in the readout', () => {
    // 2 of 4 contracts sold for +$478 banked; the 2 held are open +$660 of the +$1,138.
    const props = replayProps(view([session({ date: '2026-11-13', held: 2, pnl: 1138, realized: 478, open: 660 })]), { Plot });
    expect(rowsOfGroup(props, 0, 'How it is going')).toEqual({ 'Trade P&L': '+$1,138.00', Banked: '+$478.00', Open: '+$660.00' });
  });

  it('should call a planned-amount overrun by its words, not a breach, when the condition has not triggered', () => {
    const untriggered = (zone: 'PastStop' | 'PastTarget') =>
      replayProps(view([session({ date: '2026-11-12', instrument: DALE, held: -3, pnl: -1272, standing: value({ zone, pastBy: { dollars: usd(9), r: frac(9, 1536), crossed: false } }), outcomes: { atStop: value(usd(-1263)), atTarget: value(usd(1284)) } })]), { Plot }).sessions[0]!.readout.find((g) => g.title === STAKE)!;
    const stop = untriggered('PastStop');
    expect(stop.grid!.pastLine?.text).toBe("Past the Stop's amount by $9.00 (0.01R) · at Stop −$1,263.00");
    const target = untriggered('PastTarget');
    expect(target.grid!.pastLine?.text).toBe("Past the Target's amount by $9.00 (0.01R) · at Target +$1,284.00");
    // No ratio, so no Reward to risk row, and no word standing in for it.
    expect(stop.rows).toEqual([]);
  });

  it('should show Final result with the Execution on a final session, and No Mark in place of the stake and the Marks on a session without one', () => {
    const sale = { id: 'x2', kind: 'Execution', effect: 'Closed', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
    const final = { ...withMarks(session({ date: '2026-11-13', held: 0, pnl: 1260, realized: 1260, standing: NOT_APPLICABLE, final: { kind: 'Sold' } }), [markOf(BREN_STOCK, '104.60'), markOf(BREN)]), markers: [sale] };
    const props = replayProps(fullView([final], PLAN), { Plot });
    expect(props.sessions[0]!.readout.map((group) => group.title)).toEqual(['Final result', 'Marks', 'Position']);
    expect(rowsOfGroup(props, 0, 'Final result')).toEqual({ 'Trade P&L': '+$1,260.00', Banked: '+$1,260.00' });
    expect(rowsOfGroup(props, 0, 'Position')).toEqual({ 'Execution, Fri Nov 13': 'Sold 2 at $4.00' });
    // A Mark that was never saved reads "No Mark"; nothing is carried over.
    const none = withMarks(session({ date: '2026-11-10', pnl: null }), [markOf(BREN_STOCK, '100.20'), markOf(BREN)]);
    const gap = replayProps(fullView([none], PLAN), { Plot });
    expect(gap.sessions[0]!.readout.map((group) => group.title)).toEqual(['How it is going', 'Marks', 'Position']);
    expect(rowsOfGroup(gap, 0, 'Marks')).toEqual({ 'BREN Mark': '$100.20', 'Call Mark': 'No Mark' });
    expect(rowsOfGroup(gap, 0, 'How it is going')).toEqual({ 'Trade P&L': 'No Mark' });
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
    const bounded = gridOf(replayProps(view([dale]), { Plot }), 0);
    expect(gridRow(bounded, 'At Stop')).toMatchObject({ fromHere: { text: 'No Mark' } });
    expect(cellsOf(bounded, 'At Worst case')).toEqual(['$4,520.00', '2.94R', '−$4,520.00']);
    expect(cellsOf(bounded, 'At Max reward')).toEqual(['$464.00', '0.30R', '+$564.00']);
    // Long call (BREN): nothing caps the reward above, and there is no result to show there.
    const none = withMarks(session({ date: '2026-11-10', pnl: null, figures: { worstCaseOngoingRisk: value(usd(644)), worstCaseOngoingRiskInPlanR: value(frac(644, 324)), maximumIncrementalReward: UNBOUNDED }, outcomes: { atStop: value(usd(-324)), atTarget: value(usd(956)), atWorstCase: value(usd(-644)) } }), [markOf(BREN_STOCK, '100.20'), markOf(BREN)]);
    const long = gridOf(replayProps(fullView([none], PLAN), { Plot }), 0);
    expect(cellsOf(long, 'At Worst case')).toEqual(['$644.00', '1.99R', '−$644.00']);
    const unbounded = gridRow(long, 'At Max reward');
    expect(unbounded.fromHere).toEqual({ kind: 'Unbounded', text: 'No cap above' });
    expect(unbounded.pnlIfHit).toBeUndefined();
  });

  it('should group How it is going, At stake from here, Marks and Position, each figure finished, with its change since the earlier session', () => {
    const props = replayProps(fullView([brenWed1111], PLAN), { Plot });
    expect(readoutOf(props, 0)).toEqual([
      ['How it is going', [['Trade P&L', 'Figure', '+$520.00 · 1.60R', 'up $190.00 since Tue Nov 10']]],
      // The stake rows are the grid's (decision 8: no change line under them); the group's own rows hold the Reward to risk.
      ['At stake from here, whole Position', [['Reward to risk', 'Figure', '2.64 to 1 · about 28% : 72%', '(Plan 2.95 to 1 · 25% : 75%)']]],
      [
        'Marks',
        [
          ['BREN Mark', 'Figure', '$101.80', 'up $1.60 since Tue Nov 10'],
          ['Call Mark', 'Figure', '$3.20', 'down $0.40 since Tue Nov 10'],
        ],
      ],
      ['Position', [['Held', 'Figure', '4 contracts', undefined]]],
    ]);
  });
});

// R-BREN-U on Thu 11-12 is `brenThu1112` in the shared doubles.
describe('replay.props: the readout separates what is at stake from where the Trade ends (T9.19-B4)', () => {
  it('should head Current Risk and Remaining Reward, and give At Stop and At Worst case their amount and their P&L, with none of the six old row names', () => {
    const grid = gridOf(replayProps(fullView([brenThu1112], PLAN), { Plot }), 0);
    expect(grid.groups.map((g) => g.heading)).toEqual(['Current Risk', 'Remaining Reward']);
    expect(cellsOf(grid, 'At Stop')).toEqual(['$672.00', '2.07R', '+$316.00']);
    expect(cellsOf(grid, 'At Worst case')).toEqual(['$832.00', '2.57R', '+$156.00']);
    // The overrun stands in the place of "At Target", and the Trade's result at the Target stays in its line.
    expect(grid.pastLine?.text).toBe('Past the Target by $26.00 (0.08R) · at Target +$956.00');
    const labels = labelsOf(grid).flat();
    for (const old of ['Risk to stop', 'Result at the Stop', 'Worst case', 'Reward to target', 'Result at the Target', 'Max reward', 'At Target']) expect(labels).not.toContain(old);
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
    expect(cellsOf(gridOf(replayProps(view([dale]), { Plot }), 0), 'At Max reward')).toEqual(['$464.00', '0.30R', '+$564.00']);
    const unbounded = gridRow(gridOf(replayProps(fullView([brenThu1112], PLAN), { Plot }), 0), 'At Max reward');
    expect(unbounded.fromHere).toEqual({ kind: 'Unbounded', text: 'No cap above' });
    expect(unbounded.pnlIfHit).toBeUndefined();
  });
});

// T9AR.13 (A278): the stake group as a grid. The cells of one row, by its label: [From here, R, P&L if hit].
type StakeGrid = NonNullable<ReturnType<typeof replayProps>['sessions'][number]['readout'][number]['grid']>;
const gridOf = (props: ReturnType<typeof replayProps>, index: number): StakeGrid => props.sessions[index]!.readout.find((g) => g.title === STAKE)!.grid!;
const gridRow = (grid: StakeGrid, label: string) => grid.groups.flatMap((g) => g.rows).find((r) => r.label === label)!;
const cellsOf = (grid: StakeGrid, label: string) => {
  const row = gridRow(grid, label);
  return [row.fromHere.text, row.r?.text, row.pnlIfHit?.text];
};

// R-BREN-U on Wed 11-11, in the Stage A gate's figures: At Stop $844.00, 2.60R; the Plan's R is $324.
const brenGrid = session({
  date: '2026-11-11',
  held: 4,
  pnl: 520,
  standing: value({ zone: 'Between', share: frac(520, 956) }),
  figures: {
    ongoingRiskToStop: value(usd(844)),
    ongoingRiskToStopInPlanR: value(frac(844, 324)),
    incrementalRewardToTarget: value(usd(436)),
    incrementalRewardToTargetInPlanR: value(frac(436, 324)),
    worstCaseOngoingRisk: value(usd(1164)),
    worstCaseOngoingRiskInPlanR: value(frac(1164, 324)),
    maximumIncrementalReward: UNBOUNDED,
    rewardRiskNow: value(frac(436, 844)),
  },
  outcomes: { atStop: value(usd(-324)), atTarget: value(usd(956)), atWorstCase: value(usd(-644)) },
});

const pastOf = (spec: Partial<Parameters<typeof session>[0]> & Pick<Parameters<typeof session>[0], 'date'>) => gridOf(replayProps(fullView([session({ pnl: -740, ...spec })], PLAN), { Plot }), 0);
const labelsOf = (grid: StakeGrid) => grid.groups.map((g) => g.rows.map((r) => r.label));

describe('Readout: a Trade past a line (suggestion 6)', () => {
  it('should say Past the Stop by 300.00 at 0.50R, then at Stop −740.00 in one row above the two headings for R-AXIO-D on Mon 11-16, with no At Stop row and no 0.00', () => {
    const grid = pastOf({
      date: '2026-11-16',
      instrument: AXIO,
      held: 100,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(300), r: frac(1, 2), crossed: true } }),
      figures: { ongoingRiskToStop: value(usd(0)), ongoingRiskToStopInPlanR: value(frac(0, 1)), worstCaseOngoingRisk: value(usd(4520)), worstCaseOngoingRiskInPlanR: value(frac(4520, 600)), incrementalRewardToTarget: value(usd(1080)), incrementalRewardToTargetInPlanR: value(frac(1080, 600)) },
      outcomes: { atStop: value(usd(-740)), atTarget: value(usd(160)), atWorstCase: value(usd(-4520)) },
    });
    expect(grid.pastLine).toEqual({ text: 'Past the Stop by $300.00 (0.50R) · at Stop −$740.00', term: 'Stop Overrun' });
    expect(labelsOf(grid)).toEqual([['At Worst case'], ['At Target', 'At Max reward']]);
    expect(JSON.stringify(grid.groups)).not.toContain('$0.00');
  });

  it('should say Past the Target by 32.00 at 0.10R, then at Target gained 956.00 for R-BREN-U on Mon 11-16, with no At Target row', () => {
    const grid = pastOf({
      date: '2026-11-16',
      held: 2,
      pnl: 988,
      realized: 478,
      standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(32), r: frac(1, 10), crossed: true }, openProfitAtRisk: usd(510) }),
      figures: { ongoingRiskToStop: value(usd(672)), ongoingRiskToStopInPlanR: value(frac(672, 324)), incrementalRewardToTarget: value(usd(0)), worstCaseOngoingRisk: value(usd(832)), worstCaseOngoingRiskInPlanR: value(frac(832, 324)), maximumIncrementalReward: UNBOUNDED },
      outcomes: { atStop: value(usd(316)), atTarget: value(usd(956)), atWorstCase: value(usd(156)) },
    });
    expect(grid.pastLine).toEqual({ text: 'Past the Target by $32.00 (0.10R) · at Target +$956.00', term: 'Target Overrun' });
    expect(labelsOf(grid)).toEqual([['At Stop', 'At Worst case'], ['At Max reward']]);
  });

  it('should say Past the Stop amount by 9.00 at 0.01R, then at Stop −1,263.00 when the planned amount is passed and the Stop is not crossed, R-DALE-D Thu 11-12', () => {
    const grid = pastOf({
      date: '2026-11-12',
      instrument: DALE,
      held: -3,
      pnl: -1272,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(9), r: frac(9, 1536), crossed: false } }),
      outcomes: { atStop: value(usd(-1263)) },
    });
    expect(grid.pastLine).toEqual({ text: "Past the Stop's amount by $9.00 (0.01R) · at Stop −$1,263.00", term: 'Stop Overrun' });
  });

  it('should leave out the Reward to risk row when there is no ratio', () => {
    const rewardRows = (props: ReturnType<typeof replayProps>) => props.sessions[0]!.readout.find((g) => g.title === STAKE)!.rows.map((r) => r.label);
    // Past the Stop: the view has no ratio (Not applicable), so the row is not there, with no word standing in for it.
    const past = session({ date: '2026-11-16', instrument: AXIO, held: 100, pnl: -740, standing: value({ zone: 'PastStop', pastBy: { dollars: usd(300), r: frac(1, 2), crossed: true } }), figures: { rewardRiskNow: NOT_APPLICABLE }, outcomes: { atStop: value(usd(-740)) } });
    expect(rewardRows(replayProps(fullView([past], PLAN), { Plot }))).toEqual([]);
    // A ratio keeps its row.
    expect(rewardRows(replayProps(fullView([brenGrid], PLAN), { Plot }))).toEqual(['Reward to risk']);
  });
});

describe('Replay: reward to risk with the estimated odds (decision 4)', () => {
  const daleProps = () => replayProps(view([daleWed1111], DALE_PLAN), { Plot });

  it('should read the ratio with the odds and the Plan beside it in the Reward to risk row', () => {
    const reward = rowNamed(daleProps(), 0, 'Reward to risk')!;
    expect(reward.value).toEqual({ kind: 'Figure', text: '11.69 to 1 · about 8% : 92%' });
    expect(reward.change).toBe('(Plan 0.29 to 1 · 78% : 22%)');
  });

  it('should say under 1% : over 99% when a side is under one percent, with no about before it', () => {
    const edge = (risk: number, reward: number, targetPercent: number) =>
      rowNamed(
        replayProps(view([{ ...daleWed1111, figures: { ...daleWed1111.figures!, rewardRiskOdds: value(odds(risk, reward, targetPercent)) } }], { ...DALE_PLAN, odds: odds(risk, reward, targetPercent) }), { Plot }),
        0,
        'Reward to risk',
      )!;
    // The Target's chance is 0.5%, which the whole percents round to 1: the words follow the exact fraction.
    expect(edge(5, 995, 1).value.text).toBe('11.69 to 1 · under 1% : over 99%');
    expect(edge(5, 995, 1).change).toBe('(Plan 0.29 to 1 · under 1% : over 99%)');
    // The Stop's chance is under one percent.
    expect(edge(995, 5, 99).value.text).toContain(' · over 99% : under 1%');
  });

  it('should speak the odds in full to a screen reader: about 8% chance of the Target first, 92% of the Stop first', () => {
    expect(gridOf(daleProps(), 0).odds?.spoken).toBe('about 8% chance of the Target first, 92% of the Stop first');
  });
});

describe("Readout: the extremes' weight (decision 6)", () => {
  const weightsOf = (figures: Partial<NonNullable<ReturnType<typeof session>['figures']>>, instrument: Instrument = DALE) => {
    const s = session({ date: '2026-11-11', instrument, held: 1, pnl: 100, standing: value({ zone: 'Between', share: frac(1, 4) }), figures: { maximumIncrementalReward: UNBOUNDED, ...figures } });
    const rows = gridOf(replayProps(view([s]), { Plot }), 0).groups.flatMap((g) => g.rows);
    return Object.fromEntries(rows.map((r) => [r.label, r.weight]));
  };

  it('should mark At Worst case and At Max reward remote for R-AXIO-D and R-CORV-D and main for R-DALE-D, and treat a view without the field as main', () => {
    expect(weightsOf({ extremes: 'Remote' }, AXIO)).toMatchObject({ 'At Worst case': 'Remote', 'At Max reward': 'Remote' });
    expect(weightsOf({ extremes: 'Remote' }, BREN)).toMatchObject({ 'At Worst case': 'Remote', 'At Max reward': 'Remote' });
    expect(weightsOf({ extremes: 'Main' })).toMatchObject({ 'At Worst case': 'Main', 'At Max reward': 'Main' });
    expect(weightsOf({})).toMatchObject({ 'At Worst case': 'Main', 'At Max reward': 'Main' });
    // The Stop and the Target carry no mark: they are never dimmed.
    expect(weightsOf({ extremes: 'Remote' })).toMatchObject({ 'At Stop': undefined, 'At Target': undefined });
  });
});

describe('Readout: the change line (decision 8)', () => {
  it('should show down 150.00 since Fri Nov 13 under Trade P&L and under each Mark, and under no stake row, R-BREN-U Mon 11-16', () => {
    const since = '2026-11-13';
    const mon = withMarks(
      { ...brenGrid, date: '2026-11-16', change: { since, dollars: usd(-150) } },
      [markOf(BREN_STOCK, '101.80', { since, dollars: usd(-1.5) }), markOf(BREN, '3.20', { since, dollars: usd(-150) })],
    );
    const props = replayProps(fullView([mon], PLAN), { Plot });
    const groups = props.sessions[0]!.readout;
    const changeOf = (title: string, label: string) => groups.find((g) => g.title === title)!.rows.find((r) => r.label === label)!.change;
    expect(changeOf('How it is going', 'Trade P&L')).toBe('down $150.00 since Fri Nov 13');
    expect(changeOf('Marks', 'BREN Mark')).toBe('down $1.50 since Fri Nov 13');
    expect(changeOf('Marks', 'Call Mark')).toBe('down $150.00 since Fri Nov 13');
    // No stake row says "since": the grid has no place for a change, and its Reward to risk row carries none.
    const stake = groups.find((g) => g.title === STAKE)!;
    expect(JSON.stringify(stake)).not.toContain('since');
    expect(stake.rows.every((r) => r.change === undefined || !r.change.includes('since'))).toBe(true);
  });
});

describe('Readout: a session with no Mark (suggestion 12)', () => {
  it('should show a dash named No Mark in each cell that needs the Mark, and keep the endings and the Worst case, which need none, R-CORV-D Tue 11-10', () => {
    const corv = session({
      date: '2026-11-10',
      instrument: DALE,
      held: -3,
      pnl: null,
      outcomes: { atStop: value(usd(-318)), atTarget: value(usd(867)), atWorstCase: value(usd(-633)), atMaxReward: value(usd(23367)) },
    });
    const grid = gridOf(replayProps(view([corv]), { Plot }), 0);
    const noMark = { kind: 'Unavailable', text: 'No Mark' };
    // The amounts and their R need the Put's Mark (its table cells read "No Mark" too): a dash in each cell. What the Trade would end at needs none, so it stands in every row.
    for (const [label, ending] of [['At Stop', '−$318.00'], ['At Worst case', '−$633.00'], ['At Target', '+$867.00'], ['At Max reward', '+$23,367.00']] as const) {
      expect(gridRow(grid, label), label).toMatchObject({ fromHere: noMark, r: noMark, pnlIfHit: { text: ending } });
    }
  });

  it('should show the dash named No Mark in the Trade P&L row, and say no Mark missing anywhere in the readout, R-CORV-D Tue 11-10', () => {
    const corv = session({ date: '2026-11-10', instrument: DALE, held: -3, pnl: null });
    const readout = replayProps(view([corv]), { Plot }).sessions[0]!.readout;
    const pnl = readout.find((group) => group.title === 'How it is going')!.rows.find((r) => r.label === 'Trade P&L')!;
    expect(pnl.value).toEqual({ kind: 'Unavailable', text: 'No Mark' });
    expect(JSON.stringify(readout)).not.toContain('Mark missing');
  });
});

describe("Readout: carried from D9's Stage A gate (critic-2, section 1.8)", () => {
  it('should keep a signed amount in one piece of text in every grid cell, never P&L on one line and the amount on the next, R-DALE-D Fri 11-13 and R-BREN-U Mon 11-02', () => {
    const dale = session({
      date: '2026-11-13',
      instrument: DALE,
      held: -3,
      pnl: -1272,
      standing: value({ zone: 'Between', share: frac(1, 10) }),
      figures: { ongoingRiskToStop: value(usd(543)), ongoingRiskToStopInPlanR: value(frac(543, 1536)), worstCaseOngoingRisk: value(usd(17463)), worstCaseOngoingRiskInPlanR: value(frac(17463, 1536)), incrementalRewardToTarget: value(usd(1284)), incrementalRewardToTargetInPlanR: value(frac(1284, 1536)), maximumIncrementalReward: value(usd(464)), maximumIncrementalRewardInPlanR: value(frac(464, 1536)) },
      outcomes: { atStop: value(usd(-543)), atTarget: value(usd(1284)), atWorstCase: value(usd(-17463)), atMaxReward: value(usd(564)) },
    });
    for (const grid of [gridOf(replayProps(view([dale]), { Plot }), 0), gridOf(replayProps(fullView([{ ...brenGrid, date: '2026-11-02' }], PLAN), { Plot }), 0)]) {
      const cells = grid.groups.flatMap((g) => g.rows).flatMap((r) => [r.fromHere, r.r, r.pnlIfHit]);
      expect(cells.filter(Boolean).length).toBeGreaterThan(0);
      for (const cell of cells) if (cell?.kind === 'Figure') expect(cell.text).not.toMatch(/\s/);
    }
    expect(cellsOf(gridOf(replayProps(view([dale]), { Plot }), 0), 'At Worst case')[2]).toBe('−$17,463.00');
  });
});

describe('Readout: the stake grid (suggestion 1)', () => {
  it('should set R-BREN-U Wed 11-11 stake as a grid under Current Risk and Remaining Reward with the columns From here, R and P&L if hit: At Stop 844.00, 2.60R, −324.00', () => {
    const grid = gridOf(replayProps(fullView([brenGrid], PLAN), { Plot }), 0);
    expect(grid.columns).toEqual(['From here', 'R', 'P&L if hit']);
    expect(grid.groups.map((g) => g.heading)).toEqual(['Current Risk', 'Remaining Reward']);
    expect(cellsOf(grid, 'At Stop')).toEqual(['$844.00', '2.60R', '−$324.00']);
  });

  it('should give At Worst case 1,164.00, 3.59R, −644.00 and At Target 436.00, 1.35R, 956.00 gained, one figure to a cell', () => {
    const grid = gridOf(replayProps(fullView([brenGrid], PLAN), { Plot }), 0);
    expect(cellsOf(grid, 'At Worst case')).toEqual(['$1,164.00', '3.59R', '−$644.00']);
    expect(cellsOf(grid, 'At Target')).toEqual(['$436.00', '1.35R', '+$956.00']);
    expect(grid.groups.map((g) => g.rows.map((r) => r.label))).toEqual([['At Stop', 'At Worst case'], ['At Target', 'At Max reward']]);
  });

  it('should hand each stake row its canonical term for the accessible text, as the Stop Overrun or Target Overrun term for a row past a line', () => {
    const grid = gridOf(replayProps(fullView([brenGrid], PLAN), { Plot }), 0);
    expect(grid.groups.flatMap((g) => g.rows).map((r) => [r.label, r.term])).toEqual([
      ['At Stop', 'Ongoing Risk to Stop'],
      ['At Worst case', 'Worst-Case Ongoing Risk'],
      ['At Target', 'Incremental Reward to Target'],
      ['At Max reward', 'Maximum Incremental Reward'],
    ]);
    const past = pastOf({ date: '2026-11-16', instrument: AXIO, held: 100, standing: value({ zone: 'PastStop', pastBy: { dollars: usd(300), r: frac(1, 2), crossed: true } }), outcomes: { atStop: value(usd(-740)) } });
    expect(past.pastLine?.term).toBe('Stop Overrun');
  });

  it('should read an unbounded Max reward as No cap above across its row, with no R and no ending', () => {
    const grid = gridOf(replayProps(fullView([brenGrid], PLAN), { Plot }), 0);
    const max = gridRow(grid, 'At Max reward');
    expect(max.fromHere).toEqual({ kind: 'Unbounded', text: 'No cap above' });
    expect(max.r).toBeUndefined();
    expect(max.pnlIfHit).toBeUndefined();
  });
});

describe('Replay: one name per figure (suggestion 8)', () => {
  it('should name a realized loss Realized -440.00 (R-AXIO-D Mon 11-09) and keep Banked +478.00 for a gain', () => {
    const loss = session({ date: '2026-11-09', instrument: AXIO, held: 50, pnl: -520, realized: -440, standing: value({ zone: 'Between', share: frac(1, 10) }) });
    expect(rowsOfGroup(replayProps(view([loss]), { Plot }), 0, 'How it is going')).toEqual({ 'Trade P&L': '−$520.00', Realized: '−$440.00' });
    const gain = session({ date: '2026-11-13', held: 2, pnl: 1138, realized: 478 });
    expect(rowsOfGroup(replayProps(view([gain]), { Plot }), 0, 'How it is going')).toEqual({ 'Trade P&L': '+$1,138.00', Banked: '+$478.00' });
  });

  it('should say -440.00 of the result was realized before the end. on a final session that follows a realized loss', () => {
    const loss = session({ date: '2026-11-09', instrument: AXIO, held: 50, pnl: -520, realized: -440 });
    const final = session({ date: '2026-11-10', instrument: AXIO, held: 0, pnl: -440, realized: -440, standing: NOT_APPLICABLE, final: { kind: 'Sold' } });
    expect(sessionWords(view([loss, final]), 1).stake).toBe('Nothing is at risk and nothing is left to gain. −$440.00 of the result was realized before the end.');
  });

  it('should put a dollar sign on every price: BREN Mark $104.00 in the readout and BREN Mark: $101.80 in the hover', () => {
    const mon = withMarks(session({ date: '2026-11-16', pnl: 520 }), [markOf(BREN_STOCK, '104.00', { since: '2026-11-13', dollars: usd(-1.5) }), markOf(BREN, '3.20')]);
    const props = replayProps(fullView([mon], PLAN), { Plot });
    expect(rowsOfGroup(props, 0, 'Marks')['BREN Mark']).toBe('$104.00');
    expect(props.sessions[0]!.readout.find((g) => g.title === 'Marks')!.rows[0]!.change).toBe('down $1.50 since Fri Nov 13');
    const wed = withMarks(session({ date: '2026-11-11', pnl: 520 }), [markOf(BREN_STOCK, '101.80'), markOf(BREN, '3.20')]);
    expect(replayProps(fullView([wed], PLAN), { Plot }).sessions[0]!.hover).toContain('BREN Mark: $101.80');
  });

  it('should give every ratio two decimals: 2.00 to 1 for R-AXIO-U Plan and 0.10 to 1 for its Mon 11-16', () => {
    const mon = session({
      date: '2026-11-16',
      instrument: AXIO,
      held: 100,
      pnl: 40,
      standing: value({ zone: 'Between', share: frac(1, 10) }),
      figures: { ongoingRiskToStop: value(usd(400)), incrementalRewardToTarget: value(usd(40)), rewardRiskNow: value(frac(1, 10)), rewardRiskOdds: value(odds(400, 40, 91)) },
    });
    const planned = view([mon], { atStop: usd(-300), atTarget: usd(600), rewardRisk: frac(2, 1), odds: odds(300, 600, 33), terms: NO_TERMS });
    const reward = replayProps(planned, { Plot }).sessions[0]!.readout.find((g) => g.title === STAKE)!.rows.find((r) => r.label === 'Reward to risk')!;
    expect(reward.value.text).toBe('0.10 to 1 · about 91% : 9%');
    expect(reward.change).toBe('(Plan 2.00 to 1 · 33% : 67%)');
    expect(sessionWords(planned, 0).stake).toBe('From here: $400.00 at risk to the Stop · $40.00 more to the Target · 0.10 to 1 · about 91% : 9% (the Plan was 2.00 to 1 · 33% : 67%).');
  });
});
